import os
import json
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# If modifying these scopes, delete the file token.json first
SCOPES = ['https://www.googleapis.com/auth/script.projects']

SCRIPT_ID = '1QgOJkAQ8VD9ytHXkR2pF_HxF5zXdu_EVVHjb7mdhgAh1SfVGInucPscM'
TOKEN_FILE = 'token.json'
CLIENT_SECRET_FILE = 'agent_secret_oauth.json'

def authenticate():
    creds = None
    # The file token.json stores the user's access and refresh tokens.
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_info(
            json.load(open(TOKEN_FILE)), SCOPES)

    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                CLIENT_SECRET_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        # Save the credentials for the next run
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())
    return creds

from google.auth.transport.requests import Request
creds = authenticate()
service = build('script', 'v1', credentials=creds)

with open('long-shot-bot.js', 'r', encoding='utf-8') as f:
    local_code = f.read()

# Use the token found in the cloud as the actual LINE_ACCESS_TOKEN
cloud_token = 'gzeqISKMk/oWJo0doDdcWtMdlc03GNA6qunBM4B2cCnLcKqnx+aqFUs1xOywKFZWD43D690f3OrqEfuDlfnABkElb6eMvRHqffkN4LiZyu4saAnf+i+04zGrbM/1SIrbj50DRApqyZ1UAaqi3cfhZAdB04t89/1O/w1cDnyilFU='
local_code = local_code.replace(
    "const LINE_ACCESS_TOKEN = 'LINE_ACCESS_TOKEN';",
    f"const LINE_ACCESS_TOKEN = '{cloud_token}';"
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

response = service.projects().updateContent(
    body=request_body,
    scriptId=SCRIPT_ID
).execute()

print(f"✅ SUCCESS! Updated scriptId: {response.get('scriptId')}")