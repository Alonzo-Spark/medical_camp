from django.urls import path
from voicebot.views import TriggerTestReminderView, ExotelCallbackView, ExotelPlayXMLView, ExotelStatusView

urlpatterns = [
    path('trigger-test/', TriggerTestReminderView.as_view(), name='trigger_test'),
    path('exotel-callback/', ExotelCallbackView.as_view(), name='exotel_callback'),
    path('exotel-play/', ExotelPlayXMLView.as_view(), name='exotel_play'),
    path('exotel-status/', ExotelStatusView.as_view(), name='exotel_status'),
]
