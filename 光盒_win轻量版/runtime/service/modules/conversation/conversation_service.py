"""Conversation persistence and metadata operations."""

import json
import os
import re
import time
import uuid

from fastapi import HTTPException

from modules.storage import CONVERSATION_DIR, CONVERSATION_LOCK


def _now_ms():
    return int(time.time() * 1000)


def safe_user_id(user_id, request=None):
    candidate = (user_id or '').strip()
    if not candidate and request is not None and request.client:
        candidate = f'ip-{request.client.host}'
    if not candidate:
        candidate = 'anonymous'
    candidate = re.sub(r'[^a-zA-Z0-9_.-]', '-', candidate)[:80].strip('.-')
    return candidate or 'anonymous'


def user_dir(user_id):
    path = os.path.join(CONVERSATION_DIR, user_id)
    os.makedirs(path, exist_ok=True)
    return path


def conversation_path(user_id, conversation_id):
    cleaned = re.sub(r'[^a-zA-Z0-9_-]', '', conversation_id or '')
    if not cleaned:
        raise HTTPException(status_code=400, detail='无效的对话 ID')
    return os.path.join(user_dir(user_id), f'{cleaned}.json')


def save_conversation(user_id, conversation):
    with CONVERSATION_LOCK:
        path = conversation_path(user_id, conversation['id'])
        with open(path, 'w', encoding='utf-8') as file:
            json.dump(conversation, file, ensure_ascii=False, indent=2)


def upsert_conversation_message(user_id, conversation, message):
    message_id = message.get('id')
    messages = conversation.setdefault('messages', [])
    for index, item in enumerate(messages):
        if message_id and item.get('id') == message_id:
            messages[index] = {**item, **message}
            conversation['updated_at'] = _now_ms()
            save_conversation(user_id, conversation)
            return messages[index]
    messages.append(message)
    conversation['updated_at'] = _now_ms()
    save_conversation(user_id, conversation)
    return message


def new_conversation(user_id, title='未命名项目'):
    timestamp = _now_ms()
    conversation = {
        'id': uuid.uuid4().hex,
        'title': (title or '未命名项目')[:80],
        'created_at': timestamp,
        'updated_at': timestamp,
        'pinned': False,
        'messages': [],
    }
    save_conversation(user_id, conversation)
    return conversation


def load_conversation(user_id, conversation_id):
    path = conversation_path(user_id, conversation_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail='对话不存在')
    with open(path, 'r', encoding='utf-8') as file:
        return json.load(file)


def list_conversations(user_id):
    records = []
    for filename in os.listdir(user_dir(user_id)):
        if not filename.endswith('.json'):
            continue
        path = os.path.join(user_dir(user_id), filename)
        try:
            with open(path, 'r', encoding='utf-8') as file:
                data = json.load(file)
        except Exception:
            continue
        messages = data.get('messages', [])
        last_message = next(
            (item for item in reversed(messages) if item.get('role') != 'system'),
            None,
        )
        # Count chat turns for the dock meta "Np" badge (exclude system prompts).
        message_count = sum(1 for item in messages if item.get('role') != 'system')
        records.append({
            'id': data.get('id'),
            'title': data.get('title', '未命名项目'),
            'created_at': data.get('created_at', 0),
            'updated_at': data.get('updated_at', 0),
            'pinned': bool(data.get('pinned')),
            'last_message': (last_message or {}).get('content', ''),
            'message_count': message_count,
        })
    return sorted(
        records,
        key=lambda item: (0 if item.get('pinned') else 1, -int(item.get('updated_at') or 0)),
    )


def update_conversation_metadata(
    user_id,
    conversation_id,
    *,
    title=None,
    pinned=None,
    canvas_id=None,
    awaiting_new_canvas=None,
):
    conversation = load_conversation(user_id, conversation_id)
    if title is not None:
        normalized_title = re.sub(r'\s+', ' ', str(title or '').strip())[:80]
        if normalized_title:
            conversation['title'] = normalized_title
    if pinned is not None:
        conversation['pinned'] = bool(pinned)
    if canvas_id is not None:
        cleaned = re.sub(r'[^a-zA-Z0-9_-]', '', str(canvas_id or ''))
        conversation['canvas_id'] = cleaned
    if awaiting_new_canvas is not None:
        conversation['awaiting_new_canvas'] = bool(awaiting_new_canvas)
    conversation['updated_at'] = _now_ms()
    save_conversation(user_id, conversation)
    return conversation


def delete_conversation_record(user_id, conversation_id):
    path = conversation_path(user_id, conversation_id)
    if os.path.exists(path):
        os.remove(path)
