from dotenv import load_dotenv
import asyncio
import json
import os

from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io, get_job_context, function_tool, RunContext
from livekit.agents.llm import ChatContext, ImageContent
from livekit.plugins import noise_cancellation, silero, openai, anam
from livekit.plugins.turn_detector.multilingual import MultilingualModel

import platform_client

load_dotenv(".env.local")


# ---------------------------------------------------------------------------
# Advanced camera proctoring (face count, gaze, phone) shared by both agents.
# ---------------------------------------------------------------------------
class CameraProctor:
    # Penalty (integrity points) per violation type.
    PENALTY = {
        "no_face": 10,
        "multiple_faces": 15,
        "looking_away": 5,
        "phone_detected": 15,
    }

    def __init__(self, vision_llm: openai.LLM) -> None:
        self._vision = vision_llm
        self._frame = None
        self.violations: list[dict] = []
        self._last_flags: set[str] = set()
        self._task: asyncio.Task | None = None

    def attach(self, room: rtc.Room) -> None:
        @room.on("track_subscribed")
        def on_track(track, publication, participant):
            if (participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD and
                    publication.source == rtc.TrackSource.SOURCE_CAMERA and
                    track.kind == rtc.TrackKind.KIND_VIDEO):
                self._read(track)

    def _read(self, track: rtc.Track) -> None:
        stream = rtc.VideoStream(track)

        async def reader():
            async for event in stream:
                self._frame = event.frame

        asyncio.create_task(reader())

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._loop())

    # Seconds between webcam checks. Kept relatively high so vision calls don't
    # contend with the conversation LLM for Groq rate limits during the interview.
    INTERVAL = float(os.getenv("PROCTOR_INTERVAL_SECONDS", "12"))

    async def _loop(self) -> None:
        await asyncio.sleep(8.0)
        while True:
            await asyncio.sleep(self.INTERVAL)
            if self._frame is None:
                continue
            try:
                flags = await self._inspect()
            except Exception as e:  # vision call is best-effort
                print(f"[camera] inspect failed: {e}")
                continue
            # Record each newly-appearing violation (debounced vs the previous check).
            for f in flags:
                if f not in self._last_flags:
                    self.violations.append({"type": f, "at": asyncio.get_event_loop().time()})
                    print(f"[camera] violation: {f}")
            self._last_flags = flags

    async def _inspect(self) -> set[str]:
        chat_ctx = ChatContext()
        chat_ctx.add_message(
            role="system",
            content=(
                "You are a webcam exam proctor. Look at the frame and return ONLY JSON: "
                '{"faces": <int>, "looking_away": <true|false>, "phone": <true|false>}. '
                "faces = number of human faces visible. looking_away = true only if the person "
                "is clearly not looking at their screen. phone = true if a mobile phone is visible. "
                "Return JSON only, no commentary."
            ),
        )
        chat_ctx.add_message(
            role="user",
            content=[ImageContent(image=self._frame, inference_width=640, inference_height=480)],
        )
        raw = ""
        async for chunk in self._vision.chat(chat_ctx=chat_ctx):
            if chunk.delta and chunk.delta.content:
                raw += chunk.delta.content
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(raw)

        flags: set[str] = set()
        faces = int(data.get("faces", 1))
        if faces == 0:
            flags.add("no_face")
        elif faces > 1:
            flags.add("multiple_faces")
        if data.get("looking_away"):
            flags.add("looking_away")
        if data.get("phone"):
            flags.add("phone_detected")
        return flags

    def integrity_score(self) -> int:
        penalty = sum(self.PENALTY.get(v["type"], 5) for v in self.violations)
        return max(0, 100 - penalty)

    def summary(self) -> str:
        if not self.violations:
            return "No proctoring violations detected."
        counts: dict[str, int] = {}
        for v in self.violations:
            counts[v["type"]] = counts.get(v["type"], 0) + 1
        parts = ", ".join(f"{k.replace('_', ' ')}: {n}" for k, n in counts.items())
        return f"Proctoring flags — {parts}."


# ---------------------------------------------------------------------------
# Quiz proctor (screen monitoring) + advanced camera proctoring.
# ---------------------------------------------------------------------------
class ProctorAgent(Agent):
    def __init__(self, session: AgentSession, vision_llm: openai.LLM, application_id: str | None) -> None:
        super().__init__(
            instructions="""You are a professional exam proctor.
1. Greet the user and ask them to share their screen.
2. When they confirm screen share, call show_quiz_link.
3. Wish them good luck, then stay SILENT.
4. You will be informed when quiz is complete or violations are detected.""",
        )
        self._session = session
        self._llm = vision_llm
        self._latest_screen_frame = None
        self._room = None
        self._violation_count = 0
        self._application_id = application_id
        self._camera = CameraProctor(vision_llm)
        self._reported = False

    @function_tool()
    async def show_quiz_link(self, context: RunContext) -> str:
        """Display quiz link popup and start monitoring screen share."""
        await self._session.say(
            "Perfect! I'm setting up your quiz now. You'll see a link appear on your screen.",
            allow_interruptions=False
        )

        # Start screen + camera monitoring.
        asyncio.create_task(self._monitor_screen())
        self._camera.start()

        # Send RPC to show quiz link
        for participant in self._room.remote_participants.values():
            if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD:
                await self._room.local_participant.perform_rpc(
                    destination_identity=participant.identity,
                    method="frontend.showQuizLink",
                    payload=""
                )
                break

        return "Quiz link displayed. Wish them good luck."

    async def on_enter(self) -> None:
        """Set up screen share + camera track subscriptions."""
        self._room = get_job_context().room
        self._camera.attach(self._room)

        @self._room.on("track_subscribed")
        def on_track_subscribed(track, publication, participant):
            if (participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD and
                publication.source == rtc.TrackSource.SOURCE_SCREENSHARE and
                track.kind == rtc.TrackKind.KIND_VIDEO):
                self._create_screen_stream(track)

    def _create_screen_stream(self, track: rtc.Track) -> None:
        """Buffer latest screen share frame."""
        stream = rtc.VideoStream(track)
        async def read_stream():
            async for event in stream:
                self._latest_screen_frame = event.frame
        asyncio.create_task(read_stream())

    async def _report_proctoring(self) -> None:
        """Send accumulated proctoring signals to the platform (once)."""
        if self._reported or not self._application_id:
            return
        self._reported = True
        await platform_client.post_result({
            "applicationId": self._application_id,
            "proctoring_integrity": self._camera.integrity_score(),
            "violations": self._camera.violations,
            "ai_feedback": self._camera.summary(),
        })

    async def _monitor_screen(self) -> None:
        """Monitor screen for tab switches and quiz completion."""
        # Give user time to log onto the quiz
        await asyncio.sleep(8.0)

        while True:
            await asyncio.sleep(2.0)

            # Check screen with vision LLM
            chat_ctx = ChatContext()
            chat_ctx.add_message(
                role="system",
                content=(
                    'You are a screen monitor. Look at the screen and return ONLY one of these exact strings - nothing else:\n'
                    '- If quiz is COMPLETE/FINISHED (final results page), return the final score like "3 out of 4"\n'
                    '- If student is on Google, phone, or any other tab/app (NOT the quiz), return exactly: "TAB_SWITCH"\n'
                    '- If student is on the quiz page (even if score visible in progress), return exactly: "ON_QUIZ"\n\n'
                    'CRITICAL: Return ONLY the exact string. Do not add any explanation, commentary, or other text.'
                )
            )
            chat_ctx.add_message(
                role="user",
                content=[
                    ImageContent(
                        image=self._latest_screen_frame,
                        inference_width=1024,
                        inference_height=768
                    )
                ]
            )

            response = ""
            async for chunk in self._llm.chat(chat_ctx=chat_ctx):
                if chunk.delta and chunk.delta.content:
                    response += chunk.delta.content

            # Check if response is a score (format: "3 out of 4") - only when quiz is complete
            if "out of" in response:
                await self._session.say(
                    f"Congratulations! You scored {response}. Great job!",
                    allow_interruptions=False
                )
                await self._report_proctoring()
                break
            # Check for tab switch (also recorded as a proctoring violation)
            elif "TAB_SWITCH" in response:
                self._violation_count += 1
                self._camera.violations.append({"type": "tab_switch", "at": asyncio.get_event_loop().time()})

                if self._violation_count == 1:
                    message = "I notice you've switched tabs. Please return to the quiz window to continue your exam."
                elif self._violation_count == 2:
                    message = "This is your second warning. Please stay on the quiz page to avoid further violations."
                else:
                    message = f"Multiple violations detected. This is violation number {self._violation_count}. Your exam may be flagged for review."

                await self._session.say(message, allow_interruptions=False, add_to_chat_ctx=False)

            # Debug: log all responses to see what LLM is returning
            elif response and response != "ON_QUIZ":
                print(f"[MONITOR] LLM response: '{response}'")


# ---------------------------------------------------------------------------
# JD-driven voice AI interview + camera proctoring.
# ---------------------------------------------------------------------------
class InterviewAgent(Agent):
    def __init__(self, session: AgentSession, vision_llm: openai.LLM, application_id: str, context: dict) -> None:
        title = context.get("jobTitle", "the role")
        skills = ", ".join(context.get("skills", []) or [])
        jd = (context.get("jobDescription") or "")[:1500]
        name = context.get("candidateName", "the candidate")
        super().__init__(
            instructions=(
                f"You are a friendly but rigorous AI technical interviewer for the role of {title}. "
                f"You are interviewing {name}. Relevant skills: {skills}. Job context: {jd}\n\n"
                "Conduct a concise spoken interview of 4 to 5 questions tailored to the role and skills. "
                "Ask ONE question at a time, listen, and ask a brief follow-up when useful. "
                "Keep the whole interview under about 8 minutes. "
                "When you have enough signal, call the end_interview tool with your honest assessment: "
                "technical_score and communication_score from 0 to 100, a hiring recommendation "
                "(recommend = true if the candidate should advance to HR review, false otherwise), "
                "and 2-3 sentences of feedback justifying the decision. Then thank the candidate."
            ),
        )
        self._session = session
        self._application_id = application_id
        self._camera = CameraProctor(vision_llm)
        self._ended = False

    async def on_enter(self) -> None:
        room = get_job_context().room
        self._camera.attach(room)
        self._camera.start()

    @function_tool()
    async def end_interview(
        self,
        context: RunContext,
        technical_score: int,
        communication_score: int,
        recommend: bool,
        feedback: str,
    ) -> str:
        """Finalize the interview with scores (0-100), a hiring recommendation, and feedback."""
        if self._ended:
            return "Interview already finalized."
        self._ended = True

        overall = round((int(technical_score) + int(communication_score)) / 2)
        await platform_client.post_result({
            "applicationId": self._application_id,
            "interview_score": overall,
            "technical": int(technical_score),
            "recommend": bool(recommend),
            "proctoring_integrity": self._camera.integrity_score(),
            "violations": self._camera.violations,
            "ai_feedback": feedback + " | " + self._camera.summary(),
        })
        await self._session.say(
            "Thank you for your time. That concludes the interview. We'll be in touch with next steps.",
            allow_interruptions=False,
        )
        # Give the goodbye time to play, then close the room so the candidate's
        # client disconnects and is redirected back to the portal.
        await asyncio.sleep(5.0)
        try:
            await get_job_context().delete_room()
        except Exception as e:
            print(f"[interview] delete_room failed, disconnecting: {e}")
            try:
                await get_job_context().room.disconnect()
            except Exception:
                pass
        return "Interview finalized and results submitted."


# ---------------------------------------------------------------------------
# Career Buddy — voice/video learning & career coach for internal employees.
# ---------------------------------------------------------------------------
class CareerBuddyAgent(Agent):
    def __init__(self, session: AgentSession, employee_id: str, context: dict) -> None:
        name = context.get("name", "there")
        target = context.get("targetRole", "a senior role")
        readiness = context.get("readinessScore")
        gaps = context.get("gaps", []) or []
        path = context.get("pathItems", []) or []
        roles = context.get("openRoles", []) or []
        gap_str = ", ".join(g.get("competency", "") for g in gaps) or "none identified yet"
        path_str = ", ".join(p.get("title", "") for p in path) or "not set yet"
        super().__init__(
            instructions=(
                f"You are 'Career Buddy', a warm, encouraging career mentor speaking with {name} by voice/video. "
                f"Target role: {target}. Readiness score: {readiness}. Skill gaps: {gap_str}. "
                f"Active learning path: {path_str}. Current internal openings: {', '.join(roles) or 'none listed'}. "
                "Have a natural spoken conversation grounded ONLY in this context: advise what to learn next, "
                "promotion readiness, certifications, and internal opportunities. Keep replies concise and conversational. "
                "When the employee says goodbye or is done, call end_session with a 2-3 sentence summary of the advice you gave."
            ),
        )
        self._session = session
        self._employee_id = employee_id
        self._ended = False

    @function_tool()
    async def end_session(self, context: RunContext, summary: str) -> str:
        """End the coaching session and save a short summary to the employee's dashboard."""
        if self._ended:
            return "Session already ended."
        self._ended = True
        await platform_client.post_learning_result({
            "employeeId": self._employee_id,
            "channel": "voice",
            "summary": summary,
        })
        await self._session.say(
            "Thanks for chatting! I've saved a summary to your learning dashboard. Keep growing!",
            allow_interruptions=False,
        )
        await asyncio.sleep(4.0)
        try:
            await get_job_context().delete_room()
        except Exception:
            try:
                await get_job_context().room.disconnect()
            except Exception:
                pass
        return "Session ended."


async def _switch_to_room_audio(session: AgentSession, room: rtc.Room) -> None:
    """Publish a direct room audio track and route the agent's speech through it.

    Used to recover when an avatar's audio path dies: the agent keeps talking,
    just without the avatar video."""
    from livekit.agents.voice.room_io._output import _ParticipantAudioOutput

    out = _ParticipantAudioOutput(
        room,
        sample_rate=24000,
        num_channels=1,
        track_publish_options=rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE),
    )
    await out.start()
    session.output.replace_audio_tail(out)


def attach_avatar_watchdog(room: rtc.Room, session: AgentSession, avatar_identity: str) -> None:
    """If the avatar participant disconnects mid-call, fall back to voice-only so the
    interview can continue instead of going silent / dropping."""
    state = {"fell_back": False}

    @room.on("participant_disconnected")
    def on_disconnected(participant: rtc.RemoteParticipant):
        if participant.identity != avatar_identity or state["fell_back"]:
            return
        state["fell_back"] = True
        print(f"[watchdog] avatar '{avatar_identity}' disconnected — falling back to voice-only")

        async def recover():
            try:
                await _switch_to_room_audio(session, room)
                await session.say(
                    "It looks like my video dropped, but I can still hear you. Let's continue.",
                    allow_interruptions=False,
                )
            except Exception as e:
                print(f"[watchdog] voice-only fallback failed: {e}")

        asyncio.create_task(recover())


server = AgentServer()

@server.rtc_session()
async def my_agent(ctx: agents.JobContext):
    groq_base_url = "https://api.groq.com/openai/v1"
    groq_api_key = os.getenv("GROQ_API_KEY")

    llm = openai.LLM(
        model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        api_key=groq_api_key,
        base_url=groq_base_url,
    )
    # Separate multimodal model for screen + camera monitoring (text model can't see images)
    vision_llm = openai.LLM(
        model=os.getenv("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct"),
        api_key=groq_api_key,
        base_url=groq_base_url,
    )

    session = AgentSession(
        stt="assemblyai/universal-streaming:en",
        llm=llm,
        tts="cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )

    # Decide mode from the room name (platform names rooms assessment_<id> / interview_<id> / buddy_<id>).
    room_name = ctx.room.name
    application_id = platform_client.application_id_from_room(room_name)
    is_interview = bool(room_name) and room_name.startswith("interview_")
    is_buddy = bool(room_name) and room_name.startswith("buddy_")

    if is_buddy and application_id:
        employee_id = application_id  # buddy_<employeeId>
        context = await platform_client.fetch_learning_context(employee_id) or {}
        # Video coaching via avatar, with voice-only fallback if it drops.
        if os.getenv("BUDDY_USE_AVATAR", "1") == "1":
            try:
                avatar = anam.AvatarSession(
                    persona_config=anam.PersonaConfig(
                        name="Career Buddy",
                        avatarId="edf6fdcb-acab-44b8-b974-ded72665ee26",
                    ),
                )
                await avatar.start(session, room=ctx.room)
                attach_avatar_watchdog(ctx.room, session, avatar.avatar_identity)
            except Exception as e:
                print(f"[buddy] avatar failed to start, continuing voice-only: {e}")
        await session.start(
            room=ctx.room,
            agent=CareerBuddyAgent(session, employee_id, context),
            room_options=room_io.RoomOptions(
                video_input=True,
                audio_input=room_io.AudioInputOptions(
                    noise_cancellation=lambda params: noise_cancellation.BVCTelephony() if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP else noise_cancellation.BVC(),
                ),
            ),
        )
        await session.generate_reply(
            instructions="Warmly greet the employee by name, introduce yourself as their Career Buddy, and ask how you can help with their learning or career today."
        )
        return

    if is_interview and application_id:
        context = await platform_client.fetch_context(application_id) or {}
        # Anam avatar for the interview. Wrapped so that if it fails to start we
        # continue voice-only rather than crashing the whole call. Set
        # INTERVIEW_USE_AVATAR=0 to force voice-only.
        if os.getenv("INTERVIEW_USE_AVATAR", "1") == "1":
            try:
                avatar = anam.AvatarSession(
                    persona_config=anam.PersonaConfig(
                        name="AI Interviewer",
                        avatarId="edf6fdcb-acab-44b8-b974-ded72665ee26",
                    ),
                )
                await avatar.start(session, room=ctx.room)
                # Auto-recover to voice-only if the avatar drops mid-interview.
                attach_avatar_watchdog(ctx.room, session, avatar.avatar_identity)
            except Exception as e:
                print(f"[interview] avatar failed to start, continuing voice-only: {e}")
        await session.start(
            room=ctx.room,
            agent=InterviewAgent(session, vision_llm, application_id, context),
            room_options=room_io.RoomOptions(
                video_input=True,
                audio_input=room_io.AudioInputOptions(
                    noise_cancellation=lambda params: noise_cancellation.BVCTelephony() if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP else noise_cancellation.BVC(),
                ),
            ),
        )
        await session.generate_reply(
            instructions="Greet the candidate warmly, introduce yourself as the AI interviewer, and ask your first question."
        )
        return

    # Default: quiz proctoring (screen + camera).
    avatar = anam.AvatarSession(
        persona_config=anam.PersonaConfig(
            name="Quiz Proctor",
            avatarId="edf6fdcb-acab-44b8-b974-ded72665ee26",
        ),
    )

    await avatar.start(session, room=ctx.room)

    await session.start(
        room=ctx.room,
        agent=ProctorAgent(session, vision_llm, application_id),
        room_options=room_io.RoomOptions(
            video_input=True,
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: noise_cancellation.BVCTelephony() if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP else noise_cancellation.BVC(),
            ),
        ),
    )

    await session.generate_reply(
        instructions="Greet the user warmly and professionally. Ask them to share their screen so we can begin the exam process."
    )

if __name__ == "__main__":
    agents.cli.run_app(server)
