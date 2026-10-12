import json
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

SCRIPT_ID = '1QgOJkAQ8VD9ytHXkR2pF_HxF5zXdu_EVVHjb7mdhgAh1SfVGInucPscM'
TOKEN_FILE = 'token.json'
SCOPES = ['https://www.googleapis.com/auth/script.projects','https://www.googleapis.com/auth/script.deployments']

creds = Credentials.from_authorized_user_info(json.load(open(TOKEN_FILE)), scopes=SCOPES)
service = build('script', 'v1', credentials=creds)

# 1. Create version
version = service.projects().versions().create(
    scriptId=SCRIPT_ID,
    body={'description': f'Web App version'}
).execute()
version_num = version['versionNumber']
print(f'Created version {version_num}')

# 2. Find editable deployment (e.g. the one corresponding to web app)
deploy_resp = service.projects().deployments().list(scriptId=SCRIPT_ID).execute()
deploy_list = deploy_resp.get('deployments', [])

target_id = None
for d in deploy_list:
    # Avoid the read-only one (which often doesn't have versionNumber in config or is the library one)
    cfg = d.get('deploymentConfig', {})
    if 'versionNumber' in cfg or any(ep.get('entryPointType') == 'WEB_APP' for ep in d.get('entryPoints', [])):
        try:
            updated = service.projects().deployments().update(
                scriptId=SCRIPT_ID,
                deploymentId=d['deploymentId'],
                body={
                    'deploymentConfig': {
                        'scriptId': SCRIPT_ID,
                        'manifestFileName': 'appsscript',
                        'versionNumber': version_num
                    }
                }
            ).execute()
            print(f'Successfully updated deployment {d["deploymentId"]} to version {version_num}')
            target_id = d['deploymentId']
            break
        except Exception as e:
            print(f'Skipped deployment {d["deploymentId"]}: {e}')

if not target_id:
    print('Could not update via API. Please update version in Apps Script UI.')
