#!/usr/bin/env bash
set -uo pipefail
BASE=http://localhost:4000/api
jqp(){ python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }

curl -s -c /tmp/boss.txt -X POST $BASE/auth/register -H 'Content-Type: application/json' -d '{"email":"boss@acme.com","password":"password123","name":"Boss"}' >/dev/null
DEV=$(curl -s -c /tmp/dev.txt -X POST $BASE/auth/register -H 'Content-Type: application/json' -d '{"email":"dev@acme.com","password":"password123","name":"Dev"}')
DEVID=$(echo "$DEV" | jqp "['user']['id']")
PID=$(curl -s -b /tmp/boss.txt -X POST $BASE/projects -H 'Content-Type: application/json' -d "{\"name\":\"P\",\"memberIds\":[\"$DEVID\"]}" | jqp "['project']['id']")

mk(){ curl -s -b /tmp/boss.txt -X POST $BASE/projects/$PID/tasks -H 'Content-Type: application/json' -d "$1" >/dev/null; }
mk "{\"title\":\"Design login page\",\"priority\":\"HIGH\",\"assigneeIds\":[\"$DEVID\"],\"dueDate\":\"2020-01-01\"}"
mk "{\"title\":\"Build API\",\"priority\":\"URGENT\",\"assigneeIds\":[\"$DEVID\"]}"
mk "{\"title\":\"Write docs\",\"priority\":\"LOW\"}"
mk "{\"title\":\"Setup CI pipeline\",\"priority\":\"MEDIUM\"}"
mk "{\"title\":\"Login bug fix\",\"priority\":\"HIGH\",\"assigneeIds\":[\"$DEVID\"]}"

echo "== all (count + pagination meta) =="
curl -s -b /tmp/boss.txt "$BASE/projects/$PID/tasks?pageSize=2&page=1" | python3 -c "import sys,json;d=json.load(sys.stdin);print('total',d['total'],'page',d['page'],'pageSize',d['pageSize'],'totalPages',d['totalPages'],'items',[i['title'] for i in d['items']])"

echo "== search 'login' =="
curl -s -b /tmp/boss.txt "$BASE/projects/$PID/tasks?search=login" | python3 -c "import sys,json;print([i['title'] for i in json.load(sys.stdin)['items']])"

echo "== filter priority=HIGH,URGENT sort=priority asc =="
curl -s -b /tmp/boss.txt "$BASE/projects/$PID/tasks?priority=HIGH,URGENT&sort=priority&order=asc" | python3 -c "import sys,json;print([(i['title'],i['priority']) for i in json.load(sys.stdin)['items']])"

echo "== filter overdue=true =="
curl -s -b /tmp/boss.txt "$BASE/projects/$PID/tasks?overdue=true" | python3 -c "import sys,json;print([i['title'] for i in json.load(sys.stdin)['items']])"

echo "== my tasks (dev) — sort title asc =="
curl -s -b /tmp/dev.txt "$BASE/tasks/mine?sort=title&order=asc" | python3 -c "import sys,json;d=json.load(sys.stdin);print('total',d['total'],[i['title'] for i in d['items']])"

echo "== assigneeId filter (boss view, dev's tasks) =="
curl -s -b /tmp/boss.txt "$BASE/projects/$PID/tasks?assigneeId=$DEVID" | python3 -c "import sys,json;print([i['title'] for i in json.load(sys.stdin)['items']])"

echo "LIST_SMOKE_DONE"
