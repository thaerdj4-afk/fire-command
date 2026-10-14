package com.firecommand.worker;
import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.MediaStore;
import android.webkit.*;
import android.widget.Toast;
import org.json.JSONObject;
import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends Activity {
  static final String BASE="https://appassets.androidplatform.net/assets/worker.html";
  volatile boolean trustedDocument=false; WebView web; String currentEvent="",pendingEvent="",pendingName="",pendingWorker="",pendingToken="";
  ValueCallback<Uri[]> fileCallback; Uri cameraUri;
  boolean starting=false, explicitStart=true;
  @Override public void onCreate(Bundle state){
    super.onCreate(state);
    getWindow().setStatusBarColor(Color.rgb(4,19,33));
    getWindow().setNavigationBarColor(Color.rgb(4,19,33));
    web=new WebView(this);web.setBackgroundColor(Color.rgb(4,19,33));setContentView(web);
    web.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
    web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);
    web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(true);
    web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    web.addJavascriptInterface(new Bridge(),"FireWorker");
    WorkerPush.initialize(this);
    final WebViewAssetLoader assets=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
    web.setWebViewClient(new WebViewClient(){
      @Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap icon){trustedDocument=local(Uri.parse(url));}
      @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return assets.shouldInterceptRequest(request.getUrl());}
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
        Uri uri=request.getUrl();
        if(local(uri)){currentEvent=eventFrom(uri);return false;}
        if("https".equals(uri.getScheme())||"tel".equals(uri.getScheme())){
          try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception e){toast("לא נמצאה אפליקציה לפתיחת הקישור");}
        }
        return true;
      }
    });
    web.setWebChromeClient(new WebChromeClient(){
      @Override public boolean onJsAlert(WebView v,String u,String message,JsResult result){
        new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("אישור",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;
      }
      @Override public boolean onJsConfirm(WebView v,String u,String message,JsResult result){
        new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("אישור",(d,w)->result.confirm()).setNegativeButton("ביטול",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;
      }
      @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){
        if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;
        Intent pick=new Intent(Intent.ACTION_GET_CONTENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE);
        Intent chooser=Intent.createChooser(pick,"צילום או בחירת תמונה");
        try{
          ContentValues values=new ContentValues();values.put(MediaStore.Images.Media.DISPLAY_NAME,"fire-"+System.currentTimeMillis()+".jpg");values.put(MediaStore.Images.Media.MIME_TYPE,"image/jpeg");
          cameraUri=getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,values);
          if(cameraUri!=null){Intent camera=new Intent(MediaStore.ACTION_IMAGE_CAPTURE);camera.putExtra(MediaStore.EXTRA_OUTPUT,cameraUri);camera.setClipData(ClipData.newRawUri("photo",cameraUri));camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);if(camera.resolveActivity(getPackageManager())!=null)chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS,new Intent[]{camera});}
          startActivityForResult(chooser,2026);
        }catch(Exception e){callback.onReceiveValue(null);fileCallback=null;toast("לא ניתן לפתוח מצלמה או גלריה");}
        return true;
      }
    });
    String incoming=eventFromIntent(getIntent());
    currentEvent=incoming.isEmpty()?getSharedPreferences("worker",MODE_PRIVATE).getString("event",""):incoming;
    loadEvent(currentEvent);
  }
  boolean local(Uri u){return u!=null&&"https".equals(u.getScheme())&&"appassets.androidplatform.net".equals(u.getHost())&&"/assets/worker.html".equals(u.getPath());}
  boolean trusted(Uri u){return "https".equals(u.getScheme())&&"thaerdj4-afk.github.io".equals(u.getHost())&&"/fire-command/worker.html".equals(u.getPath());}
  String eventFrom(Uri u){if(u==null||(!trusted(u)&&!local(u)))return "";String e=u.getQueryParameter("event");return e!=null&&e.matches("[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}")?e:"";}
  String eventFromIntent(Intent intent){String fromUrl=eventFrom(intent.getData());if(!fromUrl.isEmpty())return fromUrl;String extra=intent.getStringExtra("event_id");if(extra==null)return "";try{return java.util.UUID.fromString(extra).toString();}catch(Exception e){return "";}}
  void loadEvent(String event){currentEvent=event;web.loadUrl(BASE+"?native=1"+(event.isEmpty()?"":"&event="+Uri.encode(event)));}
  @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);String next=eventFromIntent(intent);if(next.isEmpty()||next.equals(currentEvent))return;
    new AlertDialog.Builder(this).setMessage("לעבור לאירוע החדש? שיתוף המיקום באירוע הקודם יופסק.").setPositiveButton("מעבר",(d,w)->{stopNative();loadEvent(next);}).setNegativeButton("ביטול",null).show();
  }
  class Bridge {
    @JavascriptInterface public String trustedIdentity(){if(!trustedDocument)return "";android.content.SharedPreferences p=getSharedPreferences("worker_identity",MODE_PRIVATE);String id=p.getString("id",""),token=p.getString("token","");if(id.isEmpty()||token.isEmpty())return "";try{return new JSONObject().put("id",id).put("token",token).toString();}catch(Exception e){return "";}}
    @JavascriptInterface public boolean saveTrustedIdentity(String id,String token){if(!trustedDocument||id==null||token==null||!id.matches("[0-9a-fA-F-]{36}")||!token.matches("[0-9a-f]{64}"))return false;boolean ok=getSharedPreferences("worker_identity",MODE_PRIVATE).edit().putString("id",id).putString("token",token).commit();if(ok)WorkerPush.sync(MainActivity.this);return ok;}
    @JavascriptInterface public String pushToken(){return trustedDocument?getSharedPreferences("worker_identity",MODE_PRIVATE).getString("push",""):"";}
    @JavascriptInterface public String pushStatus(){if(!trustedDocument)return "";if(!WorkerPush.configured(MainActivity.this))return "התראות כשהאפליקציה סגורה ממתינות להגדרת Firebase";if(android.os.Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return "יש לאשר הרשאת התראות";return pushToken().isEmpty()?"מחבר לשירות ההתראות…":"הרשאת התראות פעילה; צליל לפי הגדרות המכשיר";}
    @JavascriptInterface public void enablePushNotifications(){if(!trustedDocument)return;runOnUiThread(()->{if(!WorkerPush.configured(MainActivity.this)){toast("שירות ההתראות עדיין לא הוגדר");return;}WorkerPush.initialize(MainActivity.this);if(android.os.Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},101);});}

    @JavascriptInterface public void startSecureLocation(String event,String id,String token){runOnUiThread(()->{if(event==null||id==null||token==null||!local(Uri.parse(web.getUrl()==null?"":web.getUrl()))||!id.matches("[0-9a-fA-F-]{36}")||!token.matches("[0-9a-f]{64}"))return;stopNative();pendingWorker=id;pendingToken=token;prepare(event,id,true);});}
    
    @JavascriptInterface public boolean isLocationSharing(){return getSharedPreferences("worker",MODE_PRIVATE).getBoolean("sharing",false);}
    @JavascriptInterface public String locationMessage(){return getSharedPreferences("worker",MODE_PRIVATE).getString("locationMessage","ממתין למיקום…");}
    @JavascriptInterface public void stopLocation(){runOnUiThread(()->stopNative());}
  }
  void prepare(String event,String name,boolean explicit){
    String pageEvent=eventFrom(Uri.parse(web.getUrl()==null?"":web.getUrl()));
    if(!event.equals(pageEvent)||name.trim().isEmpty()||starting){state("stopped","לא ניתן להפעיל מיקום: קישור האירוע אינו תואם");return;}
    if(!event.equals(currentEvent))currentEvent=event;
    android.content.SharedPreferences saved=getSharedPreferences("worker",MODE_PRIVATE);
    if(!explicit&&!saved.getBoolean("sharing",false)){state("stopped","שיתוף המיקום מופסק");return;}
    
    pendingEvent=event;pendingName=name;starting=true;explicitStart=explicit;
    if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED&&checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},100);return;}
    startNative();
  }
  void startNative(){if(!starting||pendingToken.isEmpty())return;try{
    android.content.SharedPreferences saved=getSharedPreferences("worker",MODE_PRIVATE);
    if(!pendingEvent.equals(saved.getString("event","")))stopService(new Intent(this,LocationService.class));
    saved.edit().putString("event",pendingEvent).remove("name").putBoolean("sharing",true).apply();
    Intent i=new Intent(this,LocationService.class).putExtra("workerId",pendingWorker).putExtra("sessionToken",pendingToken);startForegroundService(i);
    state("waiting","ממתין לאות GPS…");
  }catch(Exception e){state("stopped","לא ניתן להפעיל מיקום: "+e.getMessage());}finally{starting=false;pendingToken="";}}
  void stopNative(){starting=false;pendingToken="";getSharedPreferences("worker",MODE_PRIVATE).edit().putBoolean("sharing",false).apply();stopService(new Intent(this,LocationService.class));state("stopped","שיתוף המיקום מופסק");}
  void state(String state,String message){if(web!=null)web.evaluateJavascript("window.workerLocationState&&window.workerLocationState("+JSONObject.quote(state)+","+JSONObject.quote(message)+")",null);}
  void toast(String text){Toast.makeText(this,text,Toast.LENGTH_LONG).show();}
  @Override public void onRequestPermissionsResult(int req,String[] permissions,int[] results){super.onRequestPermissionsResult(req,permissions,results);if(req==100&&starting){if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED||checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED)startNative();else{starting=false;pendingToken="";state("stopped","הרשאת המיקום לא אושרה. ניתן להפעיל שיתוף בהמשך.");}}}
  @Override protected void onActivityResult(int req,int result,Intent data){super.onActivityResult(req,result,data);if(req!=2026||fileCallback==null)return;Uri[] out=null;if(result==RESULT_OK){if(data!=null&&data.getData()!=null)out=new Uri[]{data.getData()};else if(cameraUri!=null)out=new Uri[]{cameraUri};}if(cameraUri!=null&&(out==null||!cameraUri.equals(out[0])))try{getContentResolver().delete(cameraUri,null,null);}catch(Exception ignored){}cameraUri=null;fileCallback.onReceiveValue(out);fileCallback=null;}
  @Override public void onBackPressed(){moveTaskToBack(true);}
}
