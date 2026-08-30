#!/usr/bin/env bash
# Ad-hoc end-to-end smoke test against a running API on :4000. Not part of the test suite.
set -uo pipefail
BASE=http://localhost:4000/api
jqp(){ python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }

curl -s -c /tmp/boss.txt -X POST $BASE/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"boss@acme.com","password":"password123","name":"Boss"}' >/dev/null
DEV=$(curl -s -c /tmp/dev.txt -X POST $BASE/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"dev@acme.com","password":"password123","name":"Dev"}')
DEVID=$(echo "$DEV" | jqp "['user']['id']")
PROJ=$(curl -s -b /tmp/boss.txt -X POST $BASE/projects -H 'Content-Type: application/json' \
  -d "{\"name\":\"P\",\"memberIds\":[\"$DEVID\"]}")
PID=$(echo "$PROJ" | jqp "['project']['id']")
echo "project=$PID dev=$DEVID"

echo "== create task A (assign dev, overdue due date) =="
A=$(curl -s -b /tmp/boss.txt -X POST $BASE/projects/$PID/tasks -H 'Content-Type: application/json' \
  -d "{\"title\":\"Task A\",\"priority\":\"HIGH\",\"assigneeIds\":[\"$DEVID\"],\"dueDate\":\"2020-01-01\"}")
AID=$(echo "$A" | jqp "['task']['id']")
echo "$A" | jqp "['task']" | python3 -c "import sys,ast;t=ast.literal_eval(sys.stdin.read());print('status',t['status'],'overdue',t['isOverdue'],'assignees',[a['name'] for a in t['assignees']])"

echo "== create task B depends on A =="
B=$(curl -s -b /tmp/boss.txt -X POST $BASE/projects/$PID/tasks -H 'Content-Type: application/json' \
  -d "{\"title\":\"Task B\",\"dependencyIds\":[\"$AID\"]}")
BID=$(echo "$B" | jqp "['task']['id']")
echo "$B" | jqp "['task']" | python3 -c "import sys,ast;t=ast.literal_eval(sys.stdin.read());print('B blocked=',t['isBlocked'],'deps=',[d['title'] for d in t['dependencies']])"

echo "== B start while A open -> 422 blocked =="
curl -s -b /tmp/dev.txt -X POST $BASE/tasks/$BID/transition -H 'Content-Type: application/json' -d '{"status":"IN_PROGRESS"}' | jqp "['error']['message']"

echo "== invalid TODO->DONE -> 422 =="
curl -s -b /tmp/boss.txt -X POST $BASE/tasks/$AID/transition -H 'Content-Type: application/json' -d '{"status":"DONE"}' | jqp "['error']['message']"

echo "== drive A TODO->IN_PROGRESS->IN_REVIEW->DONE as assignee dev =="
for S in IN_PROGRESS IN_REVIEW DONE; do
  curl -s -b /tmp/dev.txt -X POST $BASE/tasks/$AID/transition -H 'Content-Type: application/json' -d "{\"status\":\"$S\"}" | jqp "['task']" | python3 -c "import sys,ast;t=ast.literal_eval(sys.stdin.read());print('  ->',t['status'],'completedAt',t['completedAt'])"
done

echo "== B now unblocked; manager starts B =="
curl -s -b /tmp/boss.txt -X POST $BASE/tasks/$BID/transition -H 'Content-Type: application/json' -d '{"status":"IN_PROGRESS"}' | jqp "['task']" | python3 -c "import sys,ast;t=ast.literal_eval(sys.stdin.read());print('  B status',t['status'],'blocked',t['isBlocked'])"

echo "== cycle: A depends on B -> 422 =="
curl -s -b /tmp/boss.txt -X POST $BASE/tasks/$AID/dependencies -H 'Content-Type: application/json' -d "{\"dependsOnTaskId\":\"$BID\"}" | jqp "['error']['message']"

echo "SMOKE_DONE"
