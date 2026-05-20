#!/bin/bash
# ============================================================
#  BayMaster – PM2 Management Cheat-Sheet
#  Run any of these commands on your Ubuntu server at any time
# ============================================================

# ---------- View running processes ----------
pm2 status

# ---------- View live logs ----------
pm2 logs baymaster

# ---------- Restart the app (e.g. after a code update) ----------
# Pull latest code first, then:
pm2 restart baymaster

# ---------- Stop / Start ----------
pm2 stop baymaster
pm2 start baymaster

# ---------- Reload without downtime (zero-downtime restart) ----------
pm2 reload baymaster

# ---------- Pull latest code + rebuild UI + restart (full update) ----------
# cd ~/Documents/BAY_Master
# git pull                          # if using git
# npm install --omit=dev
# cd preplanner-ui && npm install && npm run build && cd ..
# pm2 restart baymaster

# ---------- Watch PM2 dashboard in terminal ----------
pm2 monit

# ---------- Delete the process entirely (then re-add with pm2 start) ----------
pm2 delete baymaster
