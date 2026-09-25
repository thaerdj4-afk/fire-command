package com.firecommand.worker;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class LocationService extends Service implements LocationListener {

    public static final String ACTION_START =
            "com.firecommand.worker.START_TRACKING";

    public static final String ACTION_STOP =
            "com.firecommand.worker.STOP_TRACKING";

    private static final String CHANNEL_ID =
            "fire_worker_location";

    private static final int NOTIFICATION_ID = 7711;

    private static final String SUPABASE_URL =
            "https://jvubjwzzikfwsektifzi.supabase.co";

    private static final String SUPABASE_KEY =
            "sb_publishable_2sysk85O-l18YM_EAIaMJg_RAks_tpW";

    private LocationManager locationManager;
    private SharedPreferences prefs;

    private final ExecutorService executor =
            Executors.newSingleThreadExecutor();

    private volatile String workerId = null;
    private volatile boolean findingWorker = false;

    private String eventId = "";
    private String workerName = "";
    private String sector = "";

    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();

        prefs = getSharedPreferences(
                "fire_worker",
                MODE_PRIVATE
        );

        createNotificationChannel();

        locationManager =
                (LocationManager)
                        getSystemService(LOCATION_SERVICE);
    }

    @Override
    public int onStartCommand(
            Intent intent,
            int flags,
            int startId
    ) {

        String action =
                intent != null
                        ? intent.getAction()
                        : null;

        if (ACTION_STOP.equals(action)) {
            stopTracking();
            return START_NOT_STICKY;
        }

        eventId =
                prefs.getString(
                        "event_id",
                        ""
                );

        workerName =
                prefs.getString(
                        "worker_name",
                        ""
                );

        sector =
                prefs.getString(
                        "sector",
                        ""
                );

        workerId =
                prefs.getString(
                        "worker_id",
                        null
                );

        if (eventId.isEmpty() ||
                workerName.isEmpty()) {

            stopSelf();
            return START_NOT_STICKY;
        }

        startForeground(
                NOTIFICATION_ID,
                buildNotification(
                        "מתחבר ל-GPS..."
                )
        );

        acquireWakeLock();

        startLocationUpdates();

        executor.execute(
                this::ensureWorker
        );

        prefs.edit()
                .putBoolean(
                        "tracking",
                        true
                )
                .apply();

        return START_STICKY;
    }

    private void acquireWakeLock() {

        try {

            PowerManager powerManager =
                    (PowerManager)
                            getSystemService(
                                    POWER_SERVICE
                            );

            if (powerManager == null) {
                return;
            }

            wakeLock =
                    powerManager.newWakeLock(
                            PowerManager.PARTIAL_WAKE_LOCK,
                            "FireCommand:LocationWakeLock"
                    );

            wakeLock.setReferenceCounted(false);

            wakeLock.acquire();

        } catch (Exception ignored) {
        }
    }

    private void startLocationUpdates() {

        if (checkSelfPermission(
                Manifest.permission.ACCESS_FINE_LOCATION
        ) != PackageManager.PERMISSION_GRANTED
                &&
                checkSelfPermission(
                        Manifest.permission.ACCESS_COARSE_LOCATION
                ) != PackageManager.PERMISSION_GRANTED) {

            updateNotification(
                    "אין הרשאת מיקום"
            );

            stopSelf();
            return;
        }

        try {

            if (locationManager.isProviderEnabled(
                    LocationManager.GPS_PROVIDER
            )) {

                locationManager.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER,
                        5000,
                        2,
                        this
                );
            }

        } catch (Exception ignored) {
        }

        try {

            if (locationManager.isProviderEnabled(
                    LocationManager.NETWORK_PROVIDER
            )) {

                locationManager.requestLocationUpdates(
                        LocationManager.NETWORK_PROVIDER,
                        7000,
                        3,
                        this
                );
            }

        } catch (Exception ignored) {
        }

        updateNotification(
                "שיתוף מיקום פעיל"
        );
    }

    @Override
    public void onLocationChanged(Location location) {

        if (location == null) {
            return;
        }

        double latitude =
                location.getLatitude();

        double longitude =
                location.getLongitude();

        float accuracy =
                location.hasAccuracy()
                        ? location.getAccuracy()
                        : 0;

        prefs.edit()
                .putLong(
                        "last_lat",
                        Double.doubleToRawLongBits(
                                latitude
                        )
                )
                .putLong(
                        "last_lng",
                        Double.doubleToRawLongBits(
                                longitude
                        )
                )
                .apply();

        updateNotification(
                "GPS פעיל • דיוק " +
                        Math.round(accuracy) +
                        " מ׳"
        );

        executor.execute(() -> {

            try {

                if (workerId == null ||
                        workerId.trim().isEmpty()) {

                    ensureWorker();
                }

                if (workerId != null &&
                        !workerId.trim().isEmpty()) {

                    updateWorkerLocation(
                            latitude,
                            longitude
                    );
                }

            } catch (Exception ignored) {
            }
        });
    }

    private synchronized void ensureWorker() {

        if (findingWorker) {
            return;
        }

        if (workerId != null &&
                !workerId.trim().isEmpty()) {
            return;
        }

        findingWorker = true;

        try {

            String encodedEvent =
                    URLEncoder.encode(
                            eventId,
                            "UTF-8"
                    );

            String encodedName =
                    URLEncoder.encode(
                            workerName,
                            "UTF-8"
                    );

            String endpoint =
                    SUPABASE_URL +
                    "/rest/v1/workers" +
                    "?event_id=eq." +
                    encodedEvent +
                    "&name=eq." +
                    encodedName +
                    "&select=id,status" +
                    "&order=created_at.desc" +
                    "&limit=10";

            HttpURLConnection connection =
                    openConnection(
                            endpoint,
                            "GET"
                    );

            int code =
                    connection.getResponseCode();

            if (code >= 200 &&
                    code < 300) {

                String response =
                        readResponse(
                                connection.getInputStream()
                        );

                JSONArray array =
                        new JSONArray(response);

                for (int i = 0;
                     i < array.length();
                     i++) {

                    JSONObject row =
                            array.getJSONObject(i);

                    String status =
                            row.optString(
                                    "status",
                                    ""
                            );

                    if (!"סיים".equals(status)) {

                        workerId =
                                row.optString(
                                        "id",
                                        null
                                );

                        if (workerId != null &&
                                !workerId.isEmpty()) {

                            prefs.edit()
                                    .putString(
                                            "worker_id",
                                            workerId
                                    )
                                    .apply();

                            break;
                        }
                    }
                }
            }

            connection.disconnect();

            if (workerId == null ||
                    workerId.trim().isEmpty()) {

                createWorker();
            }

        } catch (Exception e) {

            updateNotification(
                    "GPS פעיל • ממתין לחיבור"
            );

        } finally {

            findingWorker = false;
        }
    }

    private void createWorker() {

        HttpURLConnection connection = null;

        try {

            String endpoint =
                    SUPABASE_URL +
                    "/rest/v1/workers";

            connection =
                    openConnection(
                            endpoint,
                            "POST"
                    );

            connection.setRequestProperty(
                    "Prefer",
                    "return=representation"
            );

            JSONObject body =
                    new JSONObject();

            body.put(
                    "event_id",
                    eventId
            );

            body.put(
                    "name",
                    workerName
            );

            body.put(
                    "status",
                    "פעיל"
            );

            if (sector != null &&
                    !sector.trim().isEmpty()) {

                body.put(
                        "sector",
                        sector.trim()
                );
            }

            writeJson(
                    connection,
                    body.toString()
            );

            int code =
                    connection.getResponseCode();

            if (code >= 200 &&
                    code < 300) {

                String response =
                        readResponse(
                                connection.getInputStream()
                        );

                JSONArray array =
                        new JSONArray(response);

                if (array.length() > 0) {

                    workerId =
                            array.getJSONObject(0)
                                    .optString(
                                            "id",
                                            null
                                    );

                    if (workerId != null &&
                            !workerId.isEmpty()) {

                        prefs.edit()
                                .putString(
                                        "worker_id",
                                        workerId
                                )
                                .apply();
                    }
                }
            }

        } catch (Exception e) {

            updateNotification(
                    "GPS פעיל • שגיאת תקשורת"
            );

        } finally {

            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private void updateWorkerLocation(
            double latitude,
            double longitude
    ) {

        HttpURLConnection connection = null;

        try {

            String encodedId =
                    URLEncoder.encode(
                            workerId,
                            "UTF-8"
                    );

            String endpoint =
                    SUPABASE_URL +
                    "/rest/v1/workers" +
                    "?id=eq." +
                    encodedId;

            connection =
                    openConnection(
                            endpoint,
                            "PATCH"
                    );

            connection.setRequestProperty(
                    "Prefer",
                    "return=minimal"
            );

            JSONObject body =
                    new JSONObject();

            body.put(
                    "latitude",
                    latitude
            );

            body.put(
                    "longitude",
                    longitude
            );

            body.put(
                    "location_updated_at",
                    Instant.now().toString()
            );

            if (sector != null &&
                    !sector.trim().isEmpty()) {

                body.put(
                        "sector",
                        sector.trim()
                );
            }

            writeJson(
                    connection,
                    body.toString()
            );

            int code =
                    connection.getResponseCode();

            if (code >= 200 &&
                    code < 300) {

                updateNotification(
                        "🟢 מיקום חי מחובר לחפ״ק"
                );

            } else {

                updateNotification(
                        "GPS פעיל • ממתין לשרת"
                );
            }

        } catch (Exception e) {

            updateNotification(
                    "GPS פעיל • אין חיבור לשרת"
            );

        } finally {

            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private HttpURLConnection openConnection(
            String address,
            String method
    ) throws Exception {

        URL url =
                new URL(address);

        HttpURLConnection connection =
                (HttpURLConnection)
                        url.openConnection();

        connection.setRequestMethod(
                method
        );

        connection.setConnectTimeout(
                15000
        );

        connection.setReadTimeout(
                15000
        );

        connection.setRequestProperty(
                "apikey",
                SUPABASE_KEY
        );

        connection.setRequestProperty(
                "Authorization",
                "Bearer " +
                        SUPABASE_KEY
        );

        connection.setRequestProperty(
                "Content-Type",
                "application/json"
        );

        connection.setRequestProperty(
                "Accept",
                "application/json"
        );

        if ("POST".equals(method) ||
                "PATCH".equals(method)) {

            connection.setDoOutput(true);
        }

        return connection;
    }

    private void writeJson(
            HttpURLConnection connection,
            String json
    ) throws Exception {

        byte[] bytes =
                json.getBytes(
                        StandardCharsets.UTF_8
                );

        connection.setFixedLengthStreamingMode(
                bytes.length
        );

        try (
                OutputStream output =
                        connection.getOutputStream()
        ) {

            output.write(bytes);
            output.flush();
        }
    }

    private String readResponse(
            InputStream inputStream
    ) throws Exception {

        BufferedReader reader =
                new BufferedReader(
                        new InputStreamReader(
                                inputStream,
                                StandardCharsets.UTF_8
                        )
                );

        StringBuilder builder =
                new StringBuilder();

        String line;

        while ((line =
                reader.readLine()) != null) {

            builder.append(line);
        }

        reader.close();

        return builder.toString();
    }

    private void stopTracking() {

        prefs.edit()
                .putBoolean(
                        "tracking",
                        false
                )
                .apply();

        try {

            if (locationManager != null) {

                locationManager.removeUpdates(
                        this
                );
            }

        } catch (Exception ignored) {
        }

        if (wakeLock != null &&
                wakeLock.isHeld()) {

            try {
                wakeLock.release();
            } catch (Exception ignored) {
            }
        }

        stopForeground(true);
        stopSelf();
    }

    private void createNotificationChannel() {

        if (Build.VERSION.SDK_INT >= 26) {

            NotificationChannel channel =
                    new NotificationChannel(
                            CHANNEL_ID,
                            "מיקום חפ״ק שריפה",
                            NotificationManager.IMPORTANCE_LOW
                    );

            channel.setDescription(
                    "שיתוף מיקום חי עם החפ״ק"
            );

            NotificationManager manager =
                    getSystemService(
                            NotificationManager.class
                    );

            if (manager != null) {

                manager.createNotificationChannel(
                        channel
                );
            }
        }
    }

    private Notification buildNotification(
            String text
    ) {

        Intent openApp =
                new Intent(
                        this,
                        MainActivity.class
                );

        openApp.setFlags(
                Intent.FLAG_ACTIVITY_SINGLE_TOP |
                        Intent.FLAG_ACTIVITY_CLEAR_TOP
        );

        int pendingFlags =
                PendingIntent.FLAG_UPDATE_CURRENT;

        if (Build.VERSION.SDK_INT >= 23) {

            pendingFlags |=
                    PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent =
                PendingIntent.getActivity(
                        this,
                        0,
                        openApp,
                        pendingFlags
                );

        Notification.Builder builder;

        if (Build.VERSION.SDK_INT >= 26) {

            builder =
                    new Notification.Builder(
                            this,
                            CHANNEL_ID
                    );

        } else {

            builder =
                    new Notification.Builder(
                            this
                    );
        }

        return builder
                .setContentTitle(
                        "🔥 חפ״ק שריפה – " +
                                workerName
                )
                .setContentText(text)
                .setSmallIcon(
                        android.R.drawable.ic_menu_mylocation
                )
                .setContentIntent(
                        pendingIntent
                )
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(
                        Notification.CATEGORY_SERVICE
                )
                .build();
    }

    private void updateNotification(
            String text
    ) {

        try {

            NotificationManager manager =
                    (NotificationManager)
                            getSystemService(
                                    NOTIFICATION_SERVICE
                            );

            if (manager != null) {

                manager.notify(
                        NOTIFICATION_ID,
                        buildNotification(text)
                );
            }

        } catch (Exception ignored) {
        }
    }

    @Override
    public void onProviderEnabled(
            String provider
    ) {
    }

    @Override
    public void onProviderDisabled(
            String provider
    ) {

        updateNotification(
                "⚠️ GPS כבוי"
        );
    }

    @Override
    public IBinder onBind(
            Intent intent
    ) {

        return null;
    }

    @Override
    public void onDestroy() {

        try {

            if (locationManager != null) {

                locationManager.removeUpdates(
                        this
                );
            }

        } catch (Exception ignored) {
        }

        if (wakeLock != null &&
                wakeLock.isHeld()) {

            try {
                wakeLock.release();
            } catch (Exception ignored) {
            }
        }

        super.onDestroy();
    }
          }
