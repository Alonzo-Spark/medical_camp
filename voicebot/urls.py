from django.urls import path
from voicebot.views import (
    # Phase 2 — Lab Test Follow-up
    LabTestQuestion1View,
    LabTestQuestion2View,
    CallStatusView,
    AskQ1View,
    AskQ2View,
    ThankYouView,
    TriggerFollowupCallView,
)

urlpatterns = [
    # ── Phase 2: Lab Test Follow-up ──────────────────────────────────────────
    path('lab-test/question1/', LabTestQuestion1View.as_view(), name='lab_test_q1'),
    path('lab-test/question2/', LabTestQuestion2View.as_view(), name='lab_test_q2'),
    path('process-q2/',         AskQ2View.as_view(),            name='process_q2'),   # alias
    path('call-status/',        CallStatusView.as_view(),       name='call_status'),
    path('ask-q1/',             AskQ1View.as_view(),            name='ask_q1'),
    path('ask-q2/',             AskQ2View.as_view(),            name='ask_q2'),
    path('thank-you/',          ThankYouView.as_view(),         name='thank_you'),
    path('trigger-followup/',   TriggerFollowupCallView.as_view(), name='trigger_followup'),
]
