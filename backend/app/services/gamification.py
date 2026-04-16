import json
import random
from datetime import date, datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from ..models import UserGameStats, User, Ticket, Profile, TicketStatus, Priority


# === LEVEL SYSTEM ===

def xp_for_level(level: int) -> int:
    """Return cumulative XP needed to reach a given level."""
    if level <= 1:
        return 0
    if level <= 10:
        return (level - 1) * 500
    if level <= 25:
        return 4500 + (level - 10) * 1000
    if level <= 50:
        return 19500 + (level - 25) * 2000
    if level <= 75:
        return 69500 + (level - 50) * 3500
    return 157000 + (level - 75) * 5000


def level_from_xp(total_xp: int) -> int:
    """Determine level from total XP."""
    level = 1
    while xp_for_level(level + 1) <= total_xp:
        level += 1
        if level >= 100:
            break
    return level


RANK_TITLES = {
    (1, 5): "Apprentice",
    (6, 10): "Journeyman",
    (11, 15): "Expert",
    (16, 20): "Master",
    (21, 25): "Grandmaster",
    (26, 30): "Myth-Seeker",
    (31, 50): "Legend",
    (51, 75): "Titan",
    (76, 99): "Immortal",
    (100, 100): "Ascended One",
}


def get_rank_title(level: int) -> str:
    for (low, high), title in RANK_TITLES.items():
        if low <= level <= high:
            return title
    return "Apprentice"


# === XP CALCULATION ===

PRIORITY_XP = {
    "very low": 50,
    "low": 75,
    "default": 100,
    "high": 150,
    "very high": 250,
}


def compute_effort_multiplier(est_hours: Optional[float]) -> float:
    if est_hours is None or est_hours <= 2:
        return 1.0
    if est_hours <= 5:
        return 1.5
    if est_hours <= 10:
        return 2.0
    return 2.5


def compute_streak_bonus(streak: int) -> float:
    """Returns multiplier, e.g., 1.3 for 3-day streak."""
    if streak < 3:
        return 1.0
    bonus = min(streak * 0.1, 1.0)  # +10% per day, max +100%
    return 1.0 + bonus


def compute_combo_bonus(combo: int) -> float:
    if combo < 3:
        return 1.0
    if combo < 5:
        return 1.2
    if combo < 10:
        return 1.4
    return 1.75


def calculate_completion_xp(ticket: Ticket, stats: UserGameStats) -> Tuple[int, dict]:
    """Calculate XP for completing a ticket. Returns (total_xp, breakdown)."""
    priority_str = ticket.priority.value if hasattr(ticket.priority, 'value') else ticket.priority
    base_xp = PRIORITY_XP.get(priority_str, 100)

    effort_mult = compute_effort_multiplier(ticket.est_hours)
    streak_mult = compute_streak_bonus(stats.current_streak)
    combo_mult = compute_combo_bonus(stats.combo_count)

    # Overdue penalty
    overdue_penalty = 0
    if ticket.due_date and ticket.due_date < date.today():
        days_overdue = (date.today() - ticket.due_date).days
        overdue_penalty = min(days_overdue * 25, 500)  # cap at 500

    # Early completion bonus
    early_bonus = 0
    if ticket.due_date and ticket.due_date > date.today():
        days_early = (ticket.due_date - date.today()).days
        if days_early >= 3:
            early_bonus = 50
        if days_early >= 7:
            early_bonus = 100

    raw_xp = int(base_xp * effort_mult * streak_mult * combo_mult) + early_bonus - overdue_penalty
    total_xp = max(raw_xp, 10)  # minimum 10 XP

    breakdown = {
        "base": base_xp,
        "effort_multiplier": effort_mult,
        "streak_multiplier": streak_mult,
        "combo_multiplier": combo_mult,
        "early_bonus": early_bonus,
        "overdue_penalty": overdue_penalty,
        "total": total_xp,
    }
    return total_xp, breakdown


SKIP_PENALTY = 50
CREATION_XP = 25  # Base XP for creating a ticket


# === ACHIEVEMENTS ===

ACHIEVEMENTS = [
    # Starter
    {"id": "first_blood", "name": "First Blood", "description": "Complete your first ticket", "xp": 50, "check": lambda s, **k: s.total_completed >= 1},
    {"id": "ticket_writer", "name": "Ticket Writer", "description": "Create your first ticket", "xp": 25, "check": lambda s, **k: s.total_created >= 1},
    {"id": "consistent", "name": "Consistent", "description": "Reach a 3-day streak", "xp": 150, "check": lambda s, **k: s.current_streak >= 3},
    {"id": "power_starter", "name": "Power Starter", "description": "Complete 5 tickets in one day", "xp": 200, "check": lambda s, **k: s.tickets_completed_today >= 5},

    # Grind
    {"id": "momentum", "name": "Momentum", "description": "Reach a 7-day streak", "xp": 300, "check": lambda s, **k: s.current_streak >= 7},
    {"id": "heavyweight", "name": "Heavyweight", "description": "Complete a ticket with 10+ estimated hours", "xp": 200, "check": lambda s, **k: k.get("ticket") and (k["ticket"].est_hours or 0) >= 10},
    {"id": "perfect_execution", "name": "Perfect Execution", "description": "Complete a ticket 2+ days before due date", "xp": 100, "check": lambda s, **k: k.get("ticket") and k["ticket"].due_date and (k["ticket"].due_date - date.today()).days >= 2},
    {"id": "unstoppable", "name": "Unstoppable", "description": "Reach a 14-day streak", "xp": 500, "check": lambda s, **k: s.current_streak >= 14},
    {"id": "no_skip_10", "name": "No Skips Club", "description": "Complete 25 tickets without any skips in between", "xp": 350, "check": lambda s, **k: s.combo_count >= 25},

    # Mastery
    {"id": "centurion", "name": "Centurion", "description": "Complete 100 tickets", "xp": 500, "check": lambda s, **k: s.total_completed >= 100},
    {"id": "level_25", "name": "Skill Collector", "description": "Reach Level 25", "xp": 500, "check": lambda s, **k: s.current_level >= 25},
    {"id": "level_50", "name": "Task Titan", "description": "Reach Level 50", "xp": 1000, "check": lambda s, **k: s.current_level >= 50},
    {"id": "iron_discipline", "name": "Iron Discipline", "description": "Reach a 30-day streak", "xp": 800, "check": lambda s, **k: s.current_streak >= 30},
    {"id": "flow_master", "name": "Flow Master", "description": "Complete 10 tickets in one day without skipping", "xp": 400, "check": lambda s, **k: s.tickets_completed_today >= 10 and s.combo_count >= 10},

    # Prestige
    {"id": "level_75", "name": "Legend", "description": "Reach Level 75", "xp": 1500, "check": lambda s, **k: s.current_level >= 75},
    {"id": "level_100", "name": "Ascended", "description": "Reach Level 100", "xp": 3000, "check": lambda s, **k: s.current_level >= 100},
    {"id": "overachiever", "name": "Overachiever", "description": "Complete 500 tickets", "xp": 750, "check": lambda s, **k: s.total_completed >= 500},
    {"id": "mythical_streak", "name": "Mythical Streak", "description": "100-day streak", "xp": 2000, "check": lambda s, **k: s.current_streak >= 100},
    {"id": "thousand", "name": "The Thousand", "description": "Complete 1000 tickets", "xp": 2000, "check": lambda s, **k: s.total_completed >= 1000},

    # Creation achievements
    {"id": "planner", "name": "The Planner", "description": "Create 10 tickets", "xp": 100, "check": lambda s, **k: s.total_created >= 10},
    {"id": "backlog_builder", "name": "Backlog Builder", "description": "Create 50 tickets", "xp": 250, "check": lambda s, **k: s.total_created >= 50},
    {"id": "ticket_machine", "name": "Ticket Machine", "description": "Create 200 tickets", "xp": 500, "check": lambda s, **k: s.total_created >= 200},
    {"id": "world_builder", "name": "World Builder", "description": "Create 500 tickets", "xp": 1000, "check": lambda s, **k: s.total_created >= 500},
]


# === DAILY CHALLENGES ===

DAILY_CHALLENGE_POOL = [
    {"id": "power_hour", "name": "Power Hour", "description": "Complete 3 high-priority tickets", "target": 3, "xp": 200, "type": "high_priority"},
    {"id": "speedster", "name": "Speedster", "description": "Complete 5 tickets today", "target": 5, "xp": 150, "type": "total_today"},
    {"id": "no_fear", "name": "No Fear", "description": "Complete 3 tickets without skipping", "target": 3, "xp": 100, "type": "no_skip"},
    {"id": "effort_junkie", "name": "Effort Junkie", "description": "Complete tickets totaling 5+ estimated hours", "target": 5, "xp": 180, "type": "total_hours"},
    {"id": "quick_wins", "name": "Quick Wins", "description": "Complete 3 tickets under 1 hour each", "target": 3, "xp": 120, "type": "quick_tickets"},
    {"id": "top_priority", "name": "Top Priority", "description": "Complete 2 very-high priority tickets", "target": 2, "xp": 200, "type": "very_high_priority"},
    {"id": "task_planner", "name": "Task Planner", "description": "Create 5 new tickets", "target": 5, "xp": 100, "type": "created_today"},
    {"id": "full_pipeline", "name": "Full Pipeline", "description": "Create 3 tickets and complete 3 tickets", "target": 3, "xp": 250, "type": "create_and_complete"},
]

WEEKLY_CHALLENGE_POOL = [
    {"id": "cleaner", "name": "The Cleaner", "description": "Complete 20 tickets this week", "target": 20, "xp": 500, "type": "weekly_total"},
    {"id": "priority_master", "name": "Priority Master", "description": "Complete 10 high+ priority tickets this week", "target": 10, "xp": 400, "type": "weekly_high_priority"},
    {"id": "streak_keeper", "name": "Streak Keeper", "description": "Maintain a 7-day streak", "target": 7, "xp": 600, "type": "weekly_streak"},
    {"id": "consistency", "name": "Consistency", "description": "Complete at least 1 ticket every day this week", "target": 7, "xp": 450, "type": "weekly_daily"},
]


def get_or_create_stats(db: Session, user_id: int) -> UserGameStats:
    stats = db.query(UserGameStats).filter(UserGameStats.user_id == user_id).first()
    if not stats:
        stats = UserGameStats(user_id=user_id)
        db.add(stats)
        db.commit()
        db.refresh(stats)
    return stats


def _reset_daily_if_needed(stats: UserGameStats):
    """Reset daily counters if date changed."""
    today = date.today()
    if stats.today_date != today:
        stats.tickets_completed_today = 0
        stats.today_date = today
        # Reset combo if last completion wasn't today or yesterday
        if stats.combo_last_date and (today - stats.combo_last_date).days > 1:
            stats.combo_count = 0


def _reset_weekly_if_needed(stats: UserGameStats):
    """Reset weekly counters if week changed (Monday reset)."""
    today = date.today()
    if stats.weekly_skips_reset is None or (today - stats.weekly_skips_reset).days >= 7:
        stats.weekly_skips = 0
        stats.weekly_skips_reset = today


def _update_streak(stats: UserGameStats):
    """Update streak based on last completion date."""
    today = date.today()
    if stats.last_completion_date is None:
        stats.current_streak = 1
    elif stats.last_completion_date == today:
        pass  # Already counted today
    elif (today - stats.last_completion_date).days == 1:
        stats.current_streak += 1
    elif (today - stats.last_completion_date).days > 1:
        # Streak broken -- check shield
        if stats.streak_shield_available and not stats.streak_shield_used:
            stats.streak_shield_used = True
            stats.current_streak += 1  # Continue streak
        else:
            stats.current_streak = 1
            stats.streak_shield_used = False

    stats.last_completion_date = today
    if stats.current_streak > stats.longest_streak:
        stats.longest_streak = stats.current_streak

    # Grant streak shield at 30-day streak
    if stats.current_streak >= 30 and not stats.streak_shield_available:
        stats.streak_shield_available = True
        stats.streak_shield_used = False


def _generate_daily_challenges(stats: UserGameStats):
    """Generate 3 random daily challenges if needed."""
    today = date.today()
    if stats.daily_challenge_date != today:
        selected = random.sample(DAILY_CHALLENGE_POOL, min(3, len(DAILY_CHALLENGE_POOL)))
        challenges = [{"id": c["id"], "name": c["name"], "description": c["description"],
                       "target": c["target"], "xp": c["xp"], "type": c["type"], "progress": 0}
                      for c in selected]
        stats.daily_challenges = json.dumps(challenges)
        stats.daily_challenge_date = today


def _generate_weekly_challenge(stats: UserGameStats):
    """Generate 1 weekly challenge if needed."""
    today = date.today()
    if stats.weekly_challenge_date is None or (today - stats.weekly_challenge_date).days >= 7:
        selected = random.choice(WEEKLY_CHALLENGE_POOL)
        challenge = {"id": selected["id"], "name": selected["name"], "description": selected["description"],
                     "target": selected["target"], "xp": selected["xp"], "type": selected["type"], "progress": 0}
        stats.weekly_challenge = json.dumps(challenge)
        stats.weekly_challenge_date = today


def _update_challenges(stats: UserGameStats, ticket: Ticket):
    """Update challenge progress after completing a ticket."""
    # Daily challenges
    challenges = json.loads(stats.daily_challenges) if stats.daily_challenges else []
    priority_str = ticket.priority.value if hasattr(ticket.priority, 'value') else str(ticket.priority)

    for c in challenges:
        if c.get("completed"):
            continue
        if c["type"] == "total_today":
            c["progress"] = stats.tickets_completed_today
        elif c["type"] == "high_priority" and priority_str in ("high", "very high"):
            c["progress"] = c.get("progress", 0) + 1
        elif c["type"] == "very_high_priority" and priority_str == "very high":
            c["progress"] = c.get("progress", 0) + 1
        elif c["type"] == "no_skip":
            c["progress"] = stats.combo_count
        elif c["type"] == "total_hours":
            c["progress"] = c.get("progress", 0) + (ticket.est_hours or 0)
        elif c["type"] == "quick_tickets" and (ticket.est_hours or 1) < 1:
            c["progress"] = c.get("progress", 0) + 1

        if c["progress"] >= c["target"]:
            c["completed"] = True

    stats.daily_challenges = json.dumps(challenges)

    # Weekly challenge
    if stats.weekly_challenge:
        wc = json.loads(stats.weekly_challenge)
        if not wc.get("completed"):
            if wc["type"] == "weekly_total":
                wc["progress"] = wc.get("progress", 0) + 1
            elif wc["type"] == "weekly_high_priority" and priority_str in ("high", "very high"):
                wc["progress"] = wc.get("progress", 0) + 1
            elif wc["type"] == "weekly_streak":
                wc["progress"] = stats.current_streak
            elif wc["type"] == "weekly_daily":
                # Approximate with streak
                wc["progress"] = min(stats.current_streak, 7)

            if wc["progress"] >= wc["target"]:
                wc["completed"] = True
            stats.weekly_challenge = json.dumps(wc)


def _check_achievements(stats: UserGameStats, ticket: Ticket = None) -> list:
    """Check and unlock new achievements. Returns list of newly unlocked."""
    unlocked = json.loads(stats.unlocked_achievements) if stats.unlocked_achievements else []
    newly_unlocked = []

    for ach in ACHIEVEMENTS:
        if ach["id"] in unlocked:
            continue
        try:
            if ach["check"](stats, ticket=ticket):
                unlocked.append(ach["id"])
                newly_unlocked.append({"id": ach["id"], "name": ach["name"], "description": ach["description"], "xp": ach["xp"]})
        except Exception:
            pass

    stats.unlocked_achievements = json.dumps(unlocked)
    return newly_unlocked


def _collect_challenge_xp(stats: UserGameStats) -> int:
    """Collect XP from completed challenges."""
    xp = 0
    challenges = json.loads(stats.daily_challenges) if stats.daily_challenges else []
    for c in challenges:
        if c.get("completed") and not c.get("xp_collected"):
            xp += c["xp"]
            c["xp_collected"] = True
    stats.daily_challenges = json.dumps(challenges)

    if stats.weekly_challenge:
        wc = json.loads(stats.weekly_challenge)
        if wc.get("completed") and not wc.get("xp_collected"):
            xp += wc["xp"]
            wc["xp_collected"] = True
            stats.weekly_challenge = json.dumps(wc)

    return xp


def process_ticket_completion(db: Session, user_id: int, ticket: Ticket) -> Optional[dict]:
    """Process gamification effects of completing a ticket. Returns event data."""
    stats = get_or_create_stats(db, user_id)
    if not stats.gamification_enabled:
        return None

    _reset_daily_if_needed(stats)
    _reset_weekly_if_needed(stats)

    # Update counters
    stats.total_completed += 1
    stats.tickets_completed_today += 1
    stats.combo_count += 1
    stats.combo_last_date = date.today()

    # Update streak
    _update_streak(stats)

    # Generate challenges if needed
    _generate_daily_challenges(stats)
    _generate_weekly_challenge(stats)

    # Calculate XP
    xp_earned, breakdown = calculate_completion_xp(ticket, stats)

    # Check achievements
    old_level = stats.current_level
    new_achievements = _check_achievements(stats, ticket=ticket)
    achievement_xp = sum(a["xp"] for a in new_achievements)

    # Update challenges
    _update_challenges(stats, ticket)
    challenge_xp = _collect_challenge_xp(stats)

    # Apply all XP
    total_xp_gain = xp_earned + achievement_xp + challenge_xp
    stats.total_xp += total_xp_gain
    stats.current_level = level_from_xp(stats.total_xp)

    # Check level-based achievements after leveling
    if stats.current_level > old_level:
        level_achievements = _check_achievements(stats)
        new_achievements.extend(level_achievements)
        level_ach_xp = sum(a["xp"] for a in level_achievements)
        stats.total_xp += level_ach_xp
        stats.current_level = level_from_xp(stats.total_xp)

    db.commit()

    # Build challenge progress list
    challenges = json.loads(stats.daily_challenges) if stats.daily_challenges else []
    wc = json.loads(stats.weekly_challenge) if stats.weekly_challenge else None
    challenge_progress = [{"name": c["name"], "progress": c.get("progress", 0), "target": c["target"],
                          "completed": c.get("completed", False)} for c in challenges]
    if wc:
        challenge_progress.append({"name": wc["name"], "progress": wc.get("progress", 0),
                                   "target": wc["target"], "completed": wc.get("completed", False)})

    return {
        "xp_earned": total_xp_gain,
        "xp_breakdown": breakdown,
        "new_total_xp": stats.total_xp,
        "level": stats.current_level,
        "leveled_up": stats.current_level > old_level,
        "new_level": stats.current_level if stats.current_level > old_level else None,
        "rank_title": get_rank_title(stats.current_level),
        "streak": stats.current_streak,
        "combo": stats.combo_count,
        "new_achievements": new_achievements,
        "challenge_progress": challenge_progress,
    }


def process_ticket_skip(db: Session, user_id: int) -> Optional[dict]:
    """Process gamification effects of skipping a ticket."""
    stats = get_or_create_stats(db, user_id)
    if not stats.gamification_enabled:
        return None

    _reset_daily_if_needed(stats)
    _reset_weekly_if_needed(stats)

    stats.total_skipped += 1
    stats.weekly_skips += 1
    stats.combo_count = 0  # Reset combo

    xp_lost = min(SKIP_PENALTY, stats.total_xp)  # Don't go below 0
    stats.total_xp = max(0, stats.total_xp - xp_lost)
    stats.current_level = level_from_xp(stats.total_xp)

    db.commit()

    return {
        "xp_lost": xp_lost,
        "new_total_xp": stats.total_xp,
        "level": stats.current_level,
        "rank_title": get_rank_title(stats.current_level),
        "combo_reset": True,
        "weekly_skips": stats.weekly_skips,
    }


def process_ticket_creation(db: Session, user_id: int, ticket: Ticket) -> Optional[dict]:
    """Process gamification effects of creating a ticket. Returns event data."""
    stats = get_or_create_stats(db, user_id)
    if not stats.gamification_enabled:
        return None

    _reset_daily_if_needed(stats)

    stats.total_created += 1

    # Base creation XP (small reward to encourage adding tickets)
    xp_earned = CREATION_XP

    # Bonus for high-priority tickets (planning hard tasks = good)
    priority_str = ticket.priority.value if hasattr(ticket.priority, 'value') else ticket.priority
    if priority_str == "very high":
        xp_earned += 15
    elif priority_str == "high":
        xp_earned += 10

    # Bonus for setting a due date (planning ahead = good)
    if ticket.due_date:
        xp_earned += 10

    # Bonus for estimating effort (disciplined planning)
    if ticket.est_hours:
        xp_earned += 5

    old_level = stats.current_level

    # Check achievements
    new_achievements = _check_achievements(stats, ticket=ticket)
    achievement_xp = sum(a["xp"] for a in new_achievements)

    # Update creation-related daily challenges
    _generate_daily_challenges(stats)
    challenges = json.loads(stats.daily_challenges) if stats.daily_challenges else []
    for c in challenges:
        if c.get("completed"):
            continue
        if c["type"] == "created_today":
            c["progress"] = c.get("progress", 0) + 1
            if c["progress"] >= c["target"]:
                c["completed"] = True
        elif c["type"] == "create_and_complete":
            # Track creation half — progress is min(created_today, completed_today)
            c["progress"] = min(stats.total_created, stats.tickets_completed_today)
            if c["progress"] >= c["target"]:
                c["completed"] = True
    stats.daily_challenges = json.dumps(challenges)

    challenge_xp = _collect_challenge_xp(stats)

    total_xp_gain = xp_earned + achievement_xp + challenge_xp
    stats.total_xp += total_xp_gain
    stats.current_level = level_from_xp(stats.total_xp)

    # Check level-based achievements
    if stats.current_level > old_level:
        level_achievements = _check_achievements(stats)
        new_achievements.extend(level_achievements)
        level_ach_xp = sum(a["xp"] for a in level_achievements)
        stats.total_xp += level_ach_xp
        stats.current_level = level_from_xp(stats.total_xp)

    db.commit()

    return {
        "xp_earned": total_xp_gain,
        "xp_breakdown": {
            "base": CREATION_XP,
            "priority_bonus": xp_earned - CREATION_XP - (10 if ticket.due_date else 0) - (5 if ticket.est_hours else 0),
            "due_date_bonus": 10 if ticket.due_date else 0,
            "effort_bonus": 5 if ticket.est_hours else 0,
            "total": total_xp_gain,
        },
        "new_total_xp": stats.total_xp,
        "level": stats.current_level,
        "leveled_up": stats.current_level > old_level,
        "new_level": stats.current_level if stats.current_level > old_level else None,
        "rank_title": get_rank_title(stats.current_level),
        "new_achievements": new_achievements,
        "total_created": stats.total_created,
    }


def get_stats_response(db: Session, user_id: int) -> dict:
    """Get full gamification stats for a user."""
    stats = get_or_create_stats(db, user_id)

    _reset_daily_if_needed(stats)
    _reset_weekly_if_needed(stats)
    _generate_daily_challenges(stats)
    _generate_weekly_challenge(stats)
    db.commit()

    current_level_xp = xp_for_level(stats.current_level)
    next_level_xp = xp_for_level(stats.current_level + 1)

    total = stats.total_completed + stats.total_skipped
    completion_rate = (stats.total_completed / total * 100) if total > 0 else 0.0

    unlocked = json.loads(stats.unlocked_achievements) if stats.unlocked_achievements else []
    all_achievements = [
        {
            "id": a["id"], "name": a["name"], "description": a["description"],
            "xp": a["xp"], "unlocked": a["id"] in unlocked
        } for a in ACHIEVEMENTS
    ]

    challenges = json.loads(stats.daily_challenges) if stats.daily_challenges else []
    wc = json.loads(stats.weekly_challenge) if stats.weekly_challenge else None

    return {
        "gamification_enabled": stats.gamification_enabled,
        "total_xp": stats.total_xp,
        "current_level": stats.current_level,
        "xp_for_current_level": current_level_xp,
        "xp_for_next_level": next_level_xp,
        "xp_progress": stats.total_xp - current_level_xp,
        "rank_title": get_rank_title(stats.current_level),
        "current_streak": stats.current_streak,
        "longest_streak": stats.longest_streak,
        "streak_shield_available": stats.streak_shield_available,
        "combo_count": stats.combo_count,
        "total_completed": stats.total_completed,
        "total_skipped": stats.total_skipped,
        "total_created": stats.total_created,
        "completion_rate": round(completion_rate, 1),
        "tickets_completed_today": stats.tickets_completed_today,
        "achievements": all_achievements,
        "daily_challenges": challenges,
        "weekly_challenge": wc,
    }
