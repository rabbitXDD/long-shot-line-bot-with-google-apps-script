import json
import os
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCRIPT_ID = '1QgOJkAQ8VD9ytHXkR2pF_HxF5zXdu_EVVHjb7mdhgAh1SfVGInucPscM'
TOKEN_FILE = 'token.json'
CLIENT_SECRET_FILE = 'agent_secret_oauth.json'
SCOPES = [
    'https://www.googleapis.com/auth/script.projects',
    'https://www.googleapis.com/auth/script.deployments'
]

def authenticate():
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_info(
            json.load(open(TOKEN_FILE)), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                CLIENT_SECRET_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())
    return creds

creds = authenticate()
service = build('script', 'v1', credentials=creds)

# 1. 建立新版本
version = service.projects().versions().create(
    scriptId=SCRIPT_ID,
    body={'description': f'Web App deployment version'}
).execute()
version_num = version['versionNumber']
print(f'Created version {version_num}')

# 2. 透過 deployments.create 建立一個乾淨的新部署（不依賴舊的唯讀 deploymentId）
try:
    new_dep = service.projects().deployments().create(
        scriptId=SCRIPT_ID,
        body={
            'versionNumber': version_num
        }
    ).execute()
    print('Successfully created new deployment!')
    print(json.dumps(new_dep, indent=2))
except Exception as e:
    print(f'Error creating new deployment: {e}')
