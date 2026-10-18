import os
import json
import google.oauth2.credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCRIPT_ID = '1QgOJkAQ8VD9ytHXkR2pF_HxF5zXdu_EVVHjb7mdhgAh1SfVGInucPscM'
# 確保使用完整的寫入 Scope，而非唯讀 Scope
SCOPES = ['https://www.googleapis.com/auth/script.projects']

# 讀取 token.json 中的 line_access_token / line_channel_secret，稍後寫回 OAuth 時保留
line_access_token = None
line_channel_secret = None
if os.path.exists('token.json'):
    with open('token.json', 'r') as _f:
        try:
            _t = json.load(_f)
            line_access_token = _t.get('line_access_token')
            line_channel_secret = _t.get('line_channel_secret')
        except json.JSONDecodeError:
            pass

creds = None
# token.json 會在第一次瀏覽器登入成功後自動產生地端快取
if os.path.exists('token.json'):
    creds = google.oauth2.credentials.Credentials.from_authorized_user_file('token.json', SCOPES)

# 如果 Token 不存在、過期或 Scope 不符，發起互動式登入
if not creds or not creds.valid:
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    else:
        # 讀取你在 GCP 建立的「桌面應用程式」OAuth 憑證
        flow = InstalledAppFlow.from_client_secrets_file('client_secret.json', SCOPES)
        creds = flow.run_local_server(port=0)
    # 儲存新取得的 Token，保留 line_access_token / line_channel_secret 欄位
    _token_data = json.loads(creds.to_json())
    if line_access_token:
        _token_data['line_access_token'] = line_access_token
    if line_channel_secret:
        _token_data['line_channel_secret'] = line_channel_secret
    with open('token.json', 'w') as token:
        token.write(json.dumps(_token_data))

service = build('script', 'v1', credentials=creds)

# 讀取並動態替換 LINE Access Token 邏輯
with open('long-shot-bot.js', 'r', encoding='utf-8') as f:
    local_code = f.read()

if not line_access_token:
    raise ValueError(
        "token.json 缺少 'line_access_token' 欄位。"
        "請手動填入真實 LINE Channel Access Token 後再執行。"
    )

if not line_channel_secret:
    raise ValueError(
        "token.json 缺少 'line_channel_secret' 欄位。"
        "請手動填入真實 LINE Channel Secret 後再執行。"
    )

local_code = local_code.replace(
    "const LINE_ACCESS_TOKEN = 'LINE_ACCESS_TOKEN';",
    f"const LINE_ACCESS_TOKEN = '{line_access_token}';"
)

local_code = local_code.replace(
    "const LINE_CHANNEL_SECRET = 'LINE_CHANNEL_SECRET';",
    f"const LINE_CHANNEL_SECRET = '{line_channel_secret}';"
)

request_body = {
    'files': [
        {
            'name': 'appsscript',
            'type': 'JSON',
            'source': '{"timeZone":"Asia/Taipei","exceptionLogging":"STACKDRIVER","runtimeVersion":"V8"}'
        },
        {
            'name': '程式碼',
            'type': 'SERVER_JS',
            'source': local_code
        }
    ]
}

# 執行改寫
response = service.projects().updateContent(body=request_body, scriptId=SCRIPT_ID).execute()
print('🏆 SUCCESS! 腳本已成功透過用戶 OAuth 2.0 更新。scriptId:', response.get('scriptId'))
