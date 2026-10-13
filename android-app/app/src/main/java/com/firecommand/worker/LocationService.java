package com.firecommand.worker;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.location.*;
import android.os.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Staging only: tokens remain in memory; every operation is scoped by the server. */
public class LocationService extends Service implements LocationListener {
  static final String CHANNEL="fire_worker_location";
  static final String SUPABASE="https://jvubjwzzikfwsektifzi.supabase.co";
  static final String KEY="sb_publishable_2sysk85O-l18YM_EAIaMJg_RAks_tpW";
  final ExecutorService executor=Executors.newSingleThreadExecutor();
  final Handler checks=new Handler(Looper.getMainLooper());
  final AtomicBoolean sending=new AtomicBoolean(false);
  LocationManager manager;
  volatile boolean destroyed=false;
  volatile Location latestLocation;
  String workerId="",token="";

  @Override public void onCreate(){super.onCreate();
    getSystemService(NotificationManager.class).createNotificationChannel(
      new NotificationChannel(CHANNEL,"מיקום חפ״ק",NotificationManager.IMPORTANCE_LOW));
  }
  @Override public int onStartCommand(Intent intent,int flags,int startId){
    if(intent==null){stopSelf();return START_NOT_STICKY;}
    String id=intent.getStringExtra("workerId"),secret=intent.getStringExtra("sessionToken");
    if(id==null||secret==null||!id.matches("[0-9a-fA-F-]{36}")||!secret.matches("[0-9a-f]{64}")){
      stopSelf();return START_NOT_STICKY;
    }
    // A running service cannot change identity. MainActivity stops it before starting another.
    if(!workerId.isEmpty())return START_NOT_STICKY;
    workerId=id;token=secret;
    startForeground(7001,notification("ממתין לאישור מיקום מאובטח…"));
    checkAndSend();
    checks.postDelayed(tick,5000);
    return START_NOT_STICKY;
  }
  final Runnable tick=new Runnable(){public void run(){if(destroyed)return;checkAndSend();checks.postDelayed(this,5000);}};
  JSONObject args()throws JSONException{return new JSONObject().put("p_worker_id",workerId).put("p_session_token",token);}
  void checkAndSend(){if(destroyed||!sending.compareAndSet(false,true))return;
    executor.execute(()->{try{
      Object profile=rpc("worker_secure_profile",args());
      if(!(profile instanceof JSONArray)||((JSONArray)profile).length()!=1){halt("ההתחברות אינה תקפה — המיקום הופסק");return;}
      if("סיים".equals(((JSONArray)profile).getJSONObject(0).optString("status"))){halt("ההשתתפות הסתיימה — המיקום הופסק");return;}
      Object inbox=rpc("worker_secure_inbox",args());
      if(!(inbox instanceof JSONArray))throw new IOException("Invalid inbox response");
      JSONArray rows=(JSONArray)inbox;
      for(int i=0;i<rows.length();i++){
        JSONObject row=rows.getJSONObject(i);
        if("הפסקת שיתוף מיקום".equals(row.optString("request_type"))&&"פעיל".equals(row.optString("status"))){halt("החפ״ק הפסיק שיתוף מיקום");return;}
      }
      if(destroyed)return;
      checks.post(()->{if(!destroyed&&manager==null)startGps();});
      Location l=latestLocation;
      if(l!=null&&SystemClock.elapsedRealtimeNanos()-l.getElapsedRealtimeNanos()<60000000000L){
        Object ok=rpc("worker_secure_update_location",args().put("p_latitude",l.getLatitude()).put("p_longitude",l.getLongitude()).put("p_accuracy",l.getAccuracy()));
        if(!Boolean.TRUE.equals(ok)){halt("עדכון מיקום נדחה — השיתוף הופסק");return;}
        if(!destroyed)updateNotification("המיקום משותף עם החפ״ק");
      }
    }catch(Exception e){if(!destroyed)updateNotification("אין אישור עדכון מהשרת — מנסה להתחבר מחדש");}
    finally{sending.set(false);}});
  }
  void startGps(){
    if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED&&checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)!=PackageManager.PERMISSION_GRANTED){halt("הרשאת המיקום לא אושרה");return;}
    manager=(LocationManager)getSystemService(LOCATION_SERVICE);
    try{if(manager.isProviderEnabled(LocationManager.GPS_PROVIDER))manager.requestLocationUpdates(LocationManager.GPS_PROVIDER,5000,0,this);}catch(SecurityException ignored){}
    try{if(manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER))manager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER,5000,0,this);}catch(SecurityException ignored){}
  }
  @Override public void onLocationChanged(Location l){if(!destroyed){latestLocation=new Location(l);checkAndSend();}}
  void halt(String message){destroyed=true;getSharedPreferences("worker",MODE_PRIVATE).edit().putBoolean("sharing",false).putString("locationMessage",message).apply();checks.post(()->{stopForeground(true);stopSelf();});}
  Object rpc(String name,JSONObject body)throws Exception{
    HttpURLConnection c=(HttpURLConnection)new URL(SUPABASE+"/rest/v1/rpc/"+name).openConnection();
    try{
      c.setRequestMethod("POST");c.setConnectTimeout(10000);c.setReadTimeout(10000);
      c.setRequestProperty("apikey",KEY);c.setRequestProperty("Content-Type","application/json");c.setDoOutput(true);
      try(OutputStream out=c.getOutputStream()){out.write(body.toString().getBytes(StandardCharsets.UTF_8));}
      int status=c.getResponseCode();if(status==401||status==403){halt("ההתחברות נדחתה — המיקום הופסק");throw new IOException("Denied");}
      if(status<200||status>=300)throw new IOException("RPC HTTP "+status);
      StringBuilder data=new StringBuilder();try(BufferedReader reader=new BufferedReader(new InputStreamReader(c.getInputStream(),StandardCharsets.UTF_8))){String line;while((line=reader.readLine())!=null)data.append(line);}
      return new JSONTokener(data.toString()).nextValue();
    }finally{c.disconnect();}
  }
  Notification notification(String text){
    PendingIntent p=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    return new Notification.Builder(this,CHANNEL).setContentTitle("חפ״ק שריפה — מיקום TEST").setContentText(text)
      .setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentIntent(p).setOngoing(true).setOnlyAlertOnce(true).build();
  }
  void updateNotification(String text){getSharedPreferences("worker",MODE_PRIVATE).edit().putString("locationMessage",text).apply();getSystemService(NotificationManager.class).notify(7001,notification(text));}
  @Override public void onDestroy(){destroyed=true;checks.removeCallbacksAndMessages(null);if(manager!=null)try{manager.removeUpdates(this);}catch(Exception ignored){}latestLocation=null;executor.shutdown();stopForeground(true);super.onDestroy();}
  @Override public IBinder onBind(Intent i){return null;}
}
