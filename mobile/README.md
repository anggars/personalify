# Personalify Mobile - Flutter Dashboard

Flutter mobile app port of the Personalify Dashboard from Next.js web app.

## 📱 Features

- **Spotify Authentication**: OAuth login using `flutter_web_auth_2`
- **Dashboard View**: Display top tracks, artists, and genres
- **Emotion Analysis**: AI-generated music vibe summary
- **Time Ranges**: Switch between short term, mid term, and long term listening data
- **Dark Mode**: Matching web design with Spotify green accent
- **Secure Storage**: Tokens stored with `flutter_secure_storage`

## 🏗 Architecture

```
lib/
├── main.dart                    # App entry with Dark theme
├── utils/
│   └── constants.dart           # API endpoints & config
├── models/
│   ├── artist.dart              # Artist model
│   ├── track.dart               # Track & Album models
│   └── user_profile.dart        # Dashboard data model
├── services/
│   ├── auth_service.dart        # OAuth handling
│   └── api_service.dart         # HTTP client (Dio)
├── screens/
│   ├── login_screen.dart        # Spotify login
│   └── dashboard_screen.dart    # Main dashboard
└── widgets/
    └── track_list_item.dart     # Track list component
```

## 🚀 Setup

### 1. Install Dependencies

```bash
flutter pub get
```

### 2. Backend Configuration

**IMPORTANT:** Backend needs to support mobile OAuth callbacks.

See artifact `backend_mobile_oauth.md` for detailed modification guide.

**Quick Summary** - Modify `backend/app/routes.py` callback endpoint to detect mobile User-Agent:

```python
user_agent = request.headers.get("user-agent", "").lower()

if "flutter" in user_agent or "dart" in user_agent:
    response = RedirectResponse(url=f"personalify://callback?spotify_id={spotify_id}")
    return response
```

### 3. Run Backend

```bash
cd backend
uvicorn app.main:app --reload
```

### 4. Run Mobile App

**Android Emulator:**

```bash
flutter run
```

Uses `http://10.0.2.2:8000` (Android Emulator localhost mapping).

## 🧪 Testing

1. Launch app → Login screen
2. Tap "Connect with Spotify"
3. Complete OAuth
4. Dashboard loads with tracks
5. Pull to refresh
6. Change time range
7. Test logout

## 🎨 Design

Dark Mode matching web (`frontend/app/globals.css`):

- Background: `#121212`
- Primary: `#1DB954` (Spotify Green)
- Text: `#FFFFFF` / `#B3B3B3`

## 📦 Dependencies

All in `pubspec.yaml`:

- `dio`, `flutter_web_auth_2`, `flutter_secure_storage`, `cached_network_image`, `provider`, `google_fonts`

## 🔗 Deep Links

Configured in `AndroidManifest.xml` for `personalify://callback` scheme.
