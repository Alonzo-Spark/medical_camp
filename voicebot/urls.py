from django.urls import path
from voicebot.views import TriggerTestReminderView

urlpatterns = [
    path('trigger-test/', TriggerTestReminderView.as_view(), name='trigger_test'),
]
