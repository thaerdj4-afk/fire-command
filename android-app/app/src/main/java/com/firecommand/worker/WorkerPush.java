package com.firecommand.worker;
import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.media.*;
import android.net.Uri;
import android.os.Build;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import java.net.*;
import java.io.*;
import java.util.UUID;
import org.json.JSONObject;

final class WorkerPush {
 static final String CHANNEL="worker_fire_invites_v1";
 static boolean configured(Context c){try{return !FirebaseApp.getApps(c).isEmpty()||FirebaseApp.initializeApp(c)!=null;}catch(Exception e){return false;}}
 static void channel(Context c){NotificationManager manager=c.getSystemService(NotificationManager.class);NotificationChannel channel=new NotificationChannel(CHANNEL,"אירועי שריפה",NotificationManager.IMPORTANCE_HIGH);channel.setDescription("הזמנות להשתתפות באירועי שריפה");channel.enableVibration(true);channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).build());manager.createNotificationChannel(channel);}
 static void initialize(Context c){channel(c);if(!configured(c))return;FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token->{c.getSharedPreferences("worker_identity",Context.MODE_PRIVATE).edit().putString("push",token).apply();sync(c);});}
 static void sync(Context context){Context c=context.getApplicationContext();new Thread(()->{HttpURLConnection connection=null;try{SharedPreferences p=c.getSharedPreferences("worker_identity",Context.MODE_PRIVATE);String id=p.getString("id",""),secret=p.getString("token",""),push=p.getString("push","");if(id.isEmpty()||!secret.matches("[0-9a-f]{64}")||push.length()<20)return;JSONObject args=new JSONObject().put("p_device_id",id).put("p_device_token",secret).put("p_push_token",push);connection=(HttpURLConnection)new URL("https://jvubjwzzikfwsektifzi.supabase.co/rest/v1/rpc/worker_device_set_push_token").openConnection();connection.setConnectTimeout(10000);connection.setReadTimeout(10000);connection.setRequestMethod("POST");connection.setRequestProperty("apikey","sb_publishable_2sysk85O-l18YM_EAIaMJg_RAks_tpW");connection.setRequestProperty("Content-Type","application/json");connection.setDoOutput(true);try(OutputStream out=connection.getOutputStream()){out.write(args.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));}int status=connection.getResponseCode();if(status>=200&&status<300)try(InputStream input=connection.getInputStream()){while(input.read()!=-1){}}
 }catch(Exception ignored){}finally{if(connection!=null)connection.disconnect();}},"worker-push-registration").start();}
 static void notify(Context c,String event,String title,String body){try{UUID.fromString(event);}catch(Exception e){return;}if(Build.VERSION.SDK_INT>=33&&c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;channel(c);Intent open=new Intent(c,MainActivity.class).setAction(Intent.ACTION_VIEW).setData(Uri.parse("https://thaerdj4-afk.github.io/fire-command/worker.html?event="+Uri.encode(event)));PendingIntent intent=PendingIntent.getActivity(c,event.hashCode(),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);Notification notification=new Notification.Builder(c,CHANNEL).setSmallIcon(com.firecommand.worker.R.drawable.worker_notification).setContentTitle(title).setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body)).setContentIntent(intent).setAutoCancel(true).setCategory(Notification.CATEGORY_EVENT).setGroup("worker_fire_events").build();c.getSystemService(NotificationManager.class).notify(event.hashCode(),notification);}
}
