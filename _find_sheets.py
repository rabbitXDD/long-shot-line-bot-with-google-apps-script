import json, os, requests

TOKEN_FILE = os.path.join(os.path.dirname(__file__), 'token.json')
SCRIPT_ID = '1QgOJkAQ8VD9ytHXkR2pF_HxF5zXdu_EVVHjb7mdhgAh1SfVGInucPscM'

def get_token():
    with open(TOKEN_FILE) as f:
        t = json.load(f)
    client = json.loads(open('agent_secret_oauth.json').read())['installed']
    token_resp = requests.post(
        'https://oauth2.googleapis.com/token',
        data={
            'client_id': client['client_id'],
            'client_secret': client['client_secret'],
            'refresh_token': t['refresh_token'],
            'grant_type': 'refresh_token',
        }
    ).json()
    token = token_resp['access_token']
    new_token = {**t, 'access_token': token, 'expires_in': token_resp.get('expires_in')}
    with open(TOKEN_FILE, 'w') as f:
        json.dump(new_token, f)
    return token

token = get_token()
h = {'Authorization': f'Bearer {token}'}

# Try Drive API to find spreadsheets
resp = requests.get(
    'https://www.googleapis.com/drive/v3/files',
    headers=h,
    params={
        'q': "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        'fields': 'files(id,name,createdTime,modifiedTime)',
        'pageSize': '50',
    }
)
print('STATUS:', resp.status_code)
print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
