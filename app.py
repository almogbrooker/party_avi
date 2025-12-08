import streamlit as st
import json
import uuid
import os
import time
import tempfile
try:
    import google.generativeai as genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

# Initialize session state
if 'game_code' not in st.session_state:
    st.session_state.game_code = None
if 'is_host' not in st.session_state:
    st.session_state.is_host = False
if 'player_id' not in st.session_state:
    st.session_state.player_id = str(uuid.uuid4())
if 'players' not in st.session_state:
    st.session_state.players = []
if 'game_stage' not in st.session_state:
    st.session_state.game_stage = 'setup'
if 'questions' not in st.session_state:
    st.session_state.questions = []
if 'current_question_index' not in st.session_state:
    st.session_state.current_question_index = 0
if 'votes' not in st.session_state:
    st.session_state.votes = {}
if 'groom_answer' not in st.session_state:
    st.session_state.groom_answer = None

# Configure Google Gemini AI
def get_gemini_client():
    if not HAS_GENAI:
        st.error("Google GenerativeAI not installed. The app will use manual entry mode.")
        return None

    # Try environment variable first (for Streamlit Cloud)
    api_key = os.getenv('GEMINI_API_KEY')

    # If not found, use the hardcoded key (for local testing)
    if not api_key:
        api_key = "AIzaSyCd3Bf_U30uxcBBalQH2QQMjVMeTIdNvO8"
        st.info("Using local API key")

    if not api_key:
        st.error("Gemini API key not found. Please set GEMINI_API_KEY environment variable.")
        return None

    try:
        genai.configure(api_key=api_key)
        return genai
    except Exception as e:
        st.error(f"Failed to configure Gemini: {str(e)}")
        return None

# Generate game code
def generate_game_code():
    return ''.join([str(uuid.uuid4())[:4].upper() for _ in range(1)])

# Player class
class Player:
    def __init__(self, id: str, name: str, is_groom: bool = False):
        self.id = id
        self.name = name
        self.is_groom = is_groom
        self.score = 0
        self.drinks = 0
        self.photo = None

# Analyze video using Gemini
def analyze_video_for_qa(video_file, video_id: str, status_callback=None):
    try:
        # Try Gemini API first
        genai_client = get_gemini_client()
        if not genai_client:
            st.warning("Gemini API not available. Using manual entry mode.")
            return None

        if status_callback:
            status_callback("מעלה וידאו...")

        # Save video to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_file:
            tmp_file.write(video_file.read())
            tmp_file_path = tmp_file.name

        try:
            # Upload video
            if status_callback:
                status_callback("מעלה וידאו לשרתים...")

            my_file = genai_client.upload_file(tmp_file_path)
            print(f"Uploaded file: {my_file.name}")

            if status_callback:
                status_callback("מעבד את הוידאו...")

            # Wait for processing
            while my_file.state.name == "PROCESSING":
                print(".", end="", flush=True)
                time.sleep(2)
                my_file = genai_client.get_file(my_file.name)

            if my_file.state.name == "FAILED":
                raise ValueError("Video processing failed")

            if status_callback:
                status_callback("מנתח שאלות ותשובות...")

            # Generate content
            model = genai_client.GenerativeModel("gemini-1.5-flash")

            prompt = """Analyze this video and extract all questions and answers.
            Return a JSON array with objects containing:
            - 'question': The question asked (in Hebrew)
            - 'answer': The answer given (in Hebrew)
            - 'startTime': When the question starts (in seconds)

            Format example: [{"question": "...", "answer": "...", "startTime": 10}]
            """

            response = model.generate_content([my_file, prompt])

            # Parse response
            try:
                qa_data = json.loads(response.text)
            except:
                # Try to extract JSON from response
                import re
                json_match = re.search(r'\[.*\]', response.text, re.DOTALL)
                if json_match:
                    qa_data = json.loads(json_match.group())
                else:
                    raise ValueError("Could not parse response as JSON")

            # Convert to required format
            qa_pairs = []
            for i, item in enumerate(qa_data):
                qa_pairs.append({
                    'id': f"q-{video_id}-{i}",
                    'video_id': video_id,
                    'question': item['question'],
                    'answer': item['answer'],
                    'q_start': item.get('startTime', i * 30),
                    'q_end': item.get('startTime', i * 30) + 5,
                    'a_start': item.get('startTime', i * 30) + 5,
                    'a_end': item.get('startTime', i * 30) + 15,
                    'timestamp_str': format_time(item.get('startTime', i * 30))
                })

            return qa_pairs

        finally:
            # Clean up temporary file
            os.unlink(tmp_file_path)

    except Exception as e:
        error_msg = str(e)
        if "quota" in error_msg.lower() or "billing" in error_msg.lower():
            st.warning("""
            ⚠️ **Gemini API requires billing for video analysis**

            The app will use manual entry mode where you can:
            - Watch the video
            - Enter questions manually
            - Play the game normally

            Manual entry works great and is completely free!
            """)
            return None
        else:
            st.error(f"Error: {error_msg}")
            return None

def format_time(seconds):
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes:02d}:{secs:02d}"

# Main UI
st.set_page_config(
    page_title="המשחק של החתן",
    page_icon="🎉",
    layout="centered",
    initial_sidebar_state="collapsed"
)

# Custom CSS
st.markdown("""
<style>
    .stApp {
        background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
        color: white;
    }
    .game-title {
        font-size: 3rem;
        font-weight: bold;
        text-align: center;
        background: linear-gradient(90deg, #fbbf24, #f59e0b);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 2rem;
    }
    .player-card {
        background: rgba(255, 255, 255, 0.1);
        padding: 1rem;
        border-radius: 10px;
        margin: 0.5rem 0;
        border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .groom-card {
        background: linear-gradient(135deg, #fbbf24, #f59e0b);
        color: #1e1b4b;
        font-weight: bold;
    }
    .question-box {
        background: rgba(255, 255, 255, 0.1);
        padding: 2rem;
        border-radius: 15px;
        margin: 1rem 0;
        border: 2px solid rgba(251, 191, 36, 0.5);
    }
    .answer-box {
        background: rgba(34, 197, 94, 0.1);
        padding: 1.5rem;
        border-radius: 10px;
        margin: 1rem 0;
        border: 1px solid rgba(34, 197, 94, 0.5);
    }
    .vote-button {
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 10px;
        font-weight: bold;
        cursor: pointer;
        margin: 0.25rem;
        transition: transform 0.2s;
    }
    .vote-button:hover {
        transform: scale(1.05);
    }
    .status-connected {
        color: #10b981;
        font-weight: bold;
    }
    .status-disconnected {
        color: #ef4444;
        font-weight: bold;
    }
</style>
""", unsafe_allow_html=True)

# Sidebar for connection info
with st.sidebar:
    st.markdown("### 📱 המשחק של החתן")

    if st.session_state.game_code:
        st.markdown(f"**קוד משחק:** `{st.session_state.game_code}`")
        st.markdown('<div class="status-connected">✓ מחובר</div>', unsafe_allow_html=True)
    else:
        st.markdown('<div class="status-disconnected">✗ מנותק</div>', unsafe_allow_html=True)

    if st.session_state.is_host:
        st.markdown("**תפקיד:** מארח")
    else:
        st.markdown("**תפקיד:** שחקן")

# Main content
if st.session_state.game_stage == 'setup':
    st.markdown('<h1 class="game-title">🎉 המשחק של החתן 🎉</h1>', unsafe_allow_html=True)

    col1, col2 = st.columns(2)

    with col1:
        st.markdown("### 🏠 צור משחק חדש")
        with st.form("create_game"):
            video_file = st.file_uploader("העלה סרטון של הכלה", type=['mp4', 'mov', 'avi'])

            if video_file:
                st.video(video_file)

                if st.form_submit_button("צור משחק"):
                    with st.spinner("מנתח את הסרטון..."):
                        video_id = str(uuid.uuid4())[:8]
                        questions = analyze_video_for_qa(video_file, video_id)

                        if questions is None:  # API requires paid plan
                            st.session_state.temp_video_file = video_file
                            st.session_state.video_id = video_id
                            st.session_state.show_manual_entry = True
                            st.rerun()
                        elif questions:
                            st.session_state.questions = questions
                            st.session_state.game_code = generate_game_code()
                            st.session_state.is_host = True
                            st.session_state.game_stage = 'lobby'
                            st.session_state.players = [Player(st.session_state.player_id, "מארח", False)]
                            st.rerun()

    with col2:
        st.markdown("### 🎮 הצטרף למשחק")
        with st.form("join_game"):
            player_name = st.text_input("שם השחקן")
            game_code = st.text_input("קוד משחק", placeholder="הכנס 4 תווים")
            is_groom = st.checkbox("אני החתן")

            if st.form_submit_button("הצטרף"):
                if player_name and game_code:
                    # In a real app, you'd validate the game code
                    st.session_state.game_code = game_code.upper()
                    st.session_state.is_host = False
                    st.session_state.game_stage = 'lobby'
                    st.session_state.players = [Player(st.session_state.player_id, player_name, is_groom)]
                    st.rerun()

# Manual Q&A Entry (when API requires paid plan)
if st.session_state.get('show_manual_entry', False):
    st.markdown('<h1 class="game-title">📝 הזן שאלות ותשובות ידנית</h1>', unsafe_allow_html=True)

    st.markdown("מכיוון שנדרש מנוי בתשלום ל-Gemini, הזן את השאלות והתשובות באופן ידני מהסרטון.")

    if 'temp_video_file' in st.session_state:
        st.video(st.session_state.temp_video_file)

    # Initialize manual questions
    if 'manual_questions' not in st.session_state:
        st.session_state.manual_questions = []

    # Add new question form
    with st.form("add_question"):
        col1, col2 = st.columns(2)
        with col1:
            question = st.text_area("שאלה", placeholder="מה צבע עיניה של הכלה?")
        with col2:
            answer = st.text_area("תשובה", placeholder="חום")
            timestamp = st.number_input("זמן התחלה (שניות)", min_value=0, value=0)

        if st.form_submit_button("➕ הוסף שאלה"):
            if question and answer:
                st.session_state.manual_questions.append({
                    'id': f"q-{st.session_state.video_id}-{len(st.session_state.manual_questions)}",
                    'video_id': st.session_state.video_id,
                    'question': question,
                    'answer': answer,
                    'q_start': timestamp,
                    'q_end': timestamp + 5,
                    'a_start': timestamp + 5,
                    'a_end': timestamp + 15,
                    'timestamp_str': format_time(timestamp)
                })
                st.success("שאלה נוספה!")
                st.rerun()

    # Display added questions
    if st.session_state.manual_questions:
        st.markdown("### שאלות שהוזנו:")
        for i, q in enumerate(st.session_state.manual_questions):
            with st.expander(f"שאלה {i+1}: {q['question'][:30]}..."):
                st.markdown(f"**שאלה:** {q['question']}")
                st.markdown(f"**תשובה:** {q['answer']}")
                st.markdown(f"**זמן:** {q['timestamp_str']}")

    col1, col2 = st.columns(2)
    with col1:
        if st.button("✅ סיימתי", type="primary", use_container_width=True):
            if st.session_state.manual_questions:
                st.session_state.questions = st.session_state.manual_questions
                st.session_state.game_code = generate_game_code()
                st.session_state.is_host = True
                st.session_state.game_stage = 'lobby'
                st.session_state.players = [Player(st.session_state.player_id, "מארח", False)]
                # Clean up temp data
                del st.session_state.show_manual_entry
                del st.session_state.temp_video_file
                del st.session_state.video_id
                st.rerun()
            else:
                st.error("אנא הוסף לפחות שאלה אחת")

    with col2:
        if st.button("❌ ביטול", use_container_width=True):
            del st.session_state.show_manual_entry
            if 'temp_video_file' in st.session_state:
                del st.session_state.temp_video_file
            if 'video_id' in st.session_state:
                del st.session_state.video_id
            st.rerun()

    st.stop()

elif st.session_state.game_stage == 'lobby':
    st.markdown('<h1 class="game-title">לובי המתנה</h1>', unsafe_allow_html=True)

    if st.session_state.is_host:
        st.markdown("### שתפו את הקישורים")

        col1, col2 = st.columns(2)

        with col1:
            st.markdown("#### 👑 קישור לחתן")
            groom_link = f"{st.secrets.get('base_url', st.get_script_run_ctx().request.url_root)}?code={st.session_state.game_code}&role=groom"
            st.code(groom_link)

        with col2:
            st.markdown("#### 👥 קישור לשחקנים")
            player_link = f"{st.secrets.get('base_url', st.get_script_run_ctx().request.url_root)}?code={st.session_state.game_code}"
            st.code(player_link)

    st.markdown("### מי כבר כאן?")

    players_container = st.container()
    with players_container:
        cols = st.columns(min(len(st.session_state.players), 4))
        for i, player in enumerate(st.session_state.players):
            with cols[i % 4]:
                if player.is_groom:
                    st.markdown(f'<div class="player-card groom-card">👑 {player.name}</div>', unsafe_allow_html=True)
                else:
                    st.markdown(f'<div class="player-card">🎮 {player.name}</div>', unsafe_allow_html=True)

    if st.session_state.is_host:
        if st.button("🎯 התחל את המשחק!", type="primary", use_container_width=True):
            st.session_state.game_stage = 'playing'
            st.session_state.current_question_index = 0
            st.rerun()
    else:
        st.info("⏳ ממתין למארח שיתחיל את המשחק...")

elif st.session_state.game_stage == 'playing':
    if st.session_state.questions and st.session_state.current_question_index < len(st.session_state.questions):
        current_q = st.session_state.questions[st.session_state.current_question_index]

        st.markdown(f'<h1 class="game-title">שאלה {st.session_state.current_question_index + 1}/{len(st.session_state.questions)}</h1>', unsafe_allow_html=True)

        st.markdown('<div class="question-box">', unsafe_allow_html=True)
        st.markdown(f"### {current_q['question']}")
        st.markdown(f"**זמן:** {current_q['timestamp_str']}")
        st.markdown('</div>', unsafe_allow_html=True)

        if st.session_state.is_host:
            # Host view - show answer and collect votes
            st.markdown('<div class="answer-box">', unsafe_allow_html=True)
            st.markdown(f"### התשובה הנכונה: {current_q['answer']}")
            st.markdown('</div>', unsafe_allow_html=True)

            st.markdown("### הצבעות השחקנים")

            if st.button("📊 הצג תוצאות", type="secondary"):
                st.success("כולם צופים בתשובה עכשיו!")

            if st.button("➡️ שאלה הבאה", type="primary"):
                st.session_state.current_question_index += 1
                st.session_state.votes = {}
                st.rerun()

        else:
            # Player view - collect answer
            st.markdown("### מה את/ה חושב/ת שהתשובה?")
            player_answer = st.text_area("הכנס את התשובה שלך")

            if st.button("שלח תשובה", type="primary"):
                if player_answer:
                    st.session_state.votes[st.session_state.player_id] = player_answer
                    st.success("תשובה נשלחה!")

                    # Check if answer is correct (simplified)
                    if player_answer.lower().strip() == current_q['answer'].lower().strip():
                        st.balloons()
                        st.success("🎉 תשובה נכונה!")
                    else:
                        st.error(f"❌ תשובה שגויה! התשובה הנכונה: {current_q['answer']}")
    else:
        st.session_state.game_stage = 'summary'
        st.rerun()

elif st.session_state.game_stage == 'summary':
    st.markdown('<h1 class="game-title">🏆 סיכום המשחק</h1>', unsafe_allow_html=True)

    st.markdown("### תודה ששיחקתם!")

    if st.button("🔄 משחק חדש", type="primary", use_container_width=True):
        for key in st.session_state.keys():
            del st.session_state[key]
        st.rerun()

# Footer
st.markdown("---")
st.markdown('<div style="text-align: center; opacity: 0.7;">נוצר באהבה למסיבת הרווקות 💙</div>', unsafe_allow_html=True)