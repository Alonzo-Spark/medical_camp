from django.urls import path
from voicebot.views import (
    # Phase 1 — Camp Reminder
    TriggerTestReminderView,
    ExotelCallbackView,
    ExotelPlayXMLView,
    ExotelStatusView,
    # Phase 2 — Lab Test Follow-up Voicebot
    TriggerFollowupCallView,
    FollowupStartView,
    FollowupResponseView,
    FollowupStatusView,
    GetPendingFollowupsView,
)

urlpatterns = [
    # ── Phase 1: Camp Reminder Calls ─────────────────────────────────────────
    path('trigger-test/',     TriggerTestReminderView.as_view(), name='trigger_test'),
    path('exotel-callback/',  ExotelCallbackView.as_view(),      name='exotel_callback'),
    path('exotel-play/',      ExotelPlayXMLView.as_view(),       name='exotel_play'),
    path('exotel-status/',    ExotelStatusView.as_view(),        name='exotel_status'),

    # ── Phase 2: Lab Test Follow-up Voicebot ─────────────────────────────────
    path('trigger-followup/',    TriggerFollowupCallView.as_view(), name='trigger_followup'),
    path('followup-start/',      FollowupStartView.as_view(),       name='followup_start'),
    path('followup-response/',   FollowupResponseView.as_view(),    name='followup_response'),
    path('followup-status/',     FollowupStatusView.as_view(),      name='followup_status'),
    path('pending-followups/',   GetPendingFollowupsView.as_view(), name='pending_followups'),
]
