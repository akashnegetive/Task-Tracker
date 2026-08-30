#!/usr/bin/env bash
set -uo pipefail
B=http://localhost:4000
echo "== root serves SPA =="; curl -s $B/ | grep -o '<title>[^<]*</title>' | head -1
echo "== SPA fallback for client route =="; curl -s -o /dev/null -w "%{http_code}\n" $B/projects
echo "== api health =="; curl -s $B/api/health
echo; echo "== login manager =="
curl -s -c /tmp/m.txt -X POST $B/api/auth/login -H 'Content-Type: application/json' -d '{"email":"manager@tasktracker.dev","password":"password123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['user']['name'])"
echo "== projects =="; curl -s -b /tmp/m.txt $B/api/projects | python3 -c "import sys,json;print([p['name'] for p in json.load(sys.stdin)['projects']])"
echo "== dashboard metrics =="; curl -s -b /tmp/m.txt $B/api/dashboard | python3 -c "import sys,json;d=json.load(sys.stdin)['dashboard'];print('metrics',d['metrics']);print('weeks',len(d['completionByWeek']),'completed total',sum(w['completed'] for w in d['completionByWeek']))"
echo "== alice overdue alerts =="
curl -s -c /tmp/a.txt -X POST $B/api/auth/login -H 'Content-Type: application/json' -d '{"email":"alice@tasktracker.dev","password":"password123"}' >/dev/null
curl -s -b /tmp/a.txt $B/api/alerts/overdue | python3 -c "import sys,json;print([a['title'] for a in json.load(sys.stdin)['alerts']])"
echo "FULLSTACK_OK"
