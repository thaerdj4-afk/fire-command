package com.firecommand.worker;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
public class WorkerMessagingService extends FirebaseMessagingService {
 @Override public void onNewToken(String token){getSharedPreferences("worker_identity",MODE_PRIVATE).edit().putString("push",token).apply();WorkerPush.sync(this);}
 @Override public void onMessageReceived(RemoteMessage message){String id=message.getData().get("event_id");if(id==null||!"fire_invitation".equals(message.getData().get("type")))return;RemoteMessage.Notification n=message.getNotification();WorkerPush.notify(this,id,n!=null&&n.getTitle()!=null?n.getTitle():"🔥 אירוע שריפה",n!=null&&n.getBody()!=null?n.getBody():"לחץ לפתיחת פרטי האירוע ולהצטרפות");}
}
