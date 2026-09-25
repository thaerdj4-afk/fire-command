package com.firecommand.worker;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {

    private static final int PERMISSION_REQUEST = 1001;

    private EditText eventInput;
    private EditText nameInput;
    private EditText sectorInput;
    private TextView statusText;

    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        prefs = getSharedPreferences("fire_worker", MODE_PRIVATE);

        buildInterface();
        loadSavedData();
        readEventFromLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readEventFromLink(intent);
    }

    private void buildInterface() {

        ScrollView scroll = new ScrollView(this);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(28), dp(20), dp(28));
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

        TextView title = new TextView(this);
        title.setText("🔥 חפ״ק שריפה – עובד");
        title.setTextSize(27);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, 0, 0, dp(8));
        root.addView(title, fullWidth());

        TextView subtitle = new TextView(this);
        subtitle.setText("שיתוף מיקום חי עם החפ״ק");
        subtitle.setTextSize(17);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, 0, 0, dp(24));
        root.addView(subtitle, fullWidth());

        eventInput = new EditText(this);
        eventInput.setHint("קישור עובד / מזהה אירוע");
        eventInput.setSingleLine(false);
        eventInput.setMinLines(2);
        eventInput.setInputType(
                InputType.TYPE_CLASS_TEXT |
                InputType.TYPE_TEXT_VARIATION_URI
        );
        root.addView(eventInput, fieldParams());

        nameInput = new EditText(this);
        nameInput.setHint("שם העובד");
        nameInput.setSingleLine(true);
        root.addView(nameInput, fieldParams());

        sectorInput = new EditText(this);
        sectorInput.setHint("גזרה / אזור – לדוגמה A");
        sectorInput.setSingleLine(true);
        root.addView(sectorInput, fieldParams());

        Button startButton = new Button(this);
        startButton.setText("📍 התחל שיתוף מיקום");
        startButton.setTextSize(18);
        startButton.setAllCaps(false);
        startButton.setOnClickListener(v -> prepareTracking());
        root.addView(startButton, buttonParams());

        Button stopButton = new Button(this);
        stopButton.setText("⛔ הפסק שיתוף מיקום");
        stopButton.setTextSize(18);
        stopButton.setAllCaps(false);
        stopButton.setOnClickListener(v -> stopTracking());
        root.addView(stopButton, buttonParams());

        Button workerPageButton = new Button(this);
        workerPageButton.setText("🚒 פתח דף עובד");
        workerPageButton.setTextSize(18);
        workerPageButton.setAllCaps(false);
        workerPageButton.setOnClickListener(v -> openWorkerPage());
        root.addView(workerPageButton, buttonParams());

        Button batteryButton = new Button(this);
        batteryButton.setText("🔋 הגדרות סוללה");
        batteryButton.setTextSize(16);
        batteryButton.setAllCaps(false);
        batteryButton.setOnClickListener(v -> openBatterySettings());
        root.addView(batteryButton, buttonParams());

        statusText = new TextView(this);
        statusText.setText("המיקום אינו משותף");
        statusText.setTextSize(17);
        statusText.setGravity(Gravity.CENTER);
        statusText.setPadding(
                dp(10),
                dp(25),
                dp(10),
                dp(20)
        );
        root.addView(statusText, fullWidth());

        TextView info = new TextView(this);
        info.setText(
                "כאשר שיתוף המיקום פעיל תופיע התראה קבועה בטלפון.\n" +
                "אין לסגור את ההתראה בזמן העבודה."
        );
        info.setTextSize(14);
        info.setGravity(Gravity.CENTER);
        root.addView(info, fullWidth());

        scroll.addView(root);
        setContentView(scroll);
    }

    private void loadSavedData() {

        eventInput.setText(
                prefs.getString("event_id", "")
        );

        nameInput.setText(
                prefs.getString("worker_name", "")
        );

        sectorInput.setText(
                prefs.getString("sector", "")
        );

        if (prefs.getBoolean("tracking", false)) {
            statusText.setText(
                    "🟢 שיתוף המיקום פעיל"
            );
        }
    }

    private void readEventFromLink(Intent intent) {

        if (intent == null) return;

        Uri data = intent.getData();

        if (data == null) return;

        String event = data.getQueryParameter("event");

        if (event != null && !event.trim().isEmpty()) {
            eventInput.setText(event.trim());
        }
    }

    private String extractEventId(String value) {

        if (value == null) return "";

        value = value.trim();

        if (value.isEmpty()) return "";

        try {

            Uri uri = Uri.parse(value);

            String event =
                    uri.getQueryParameter("event");

            if (event != null &&
                    !event.trim().isEmpty()) {

                return event.trim();
            }

        } catch (Exception ignored) {
        }

        return value;
    }

    private void prepareTracking() {

        String eventId =
                extractEventId(
                        eventInput.getText().toString()
                );

        String workerName =
                nameInput.getText()
                        .toString()
                        .trim();

        String sector =
                sectorInput.getText()
                        .toString()
                        .trim();

        if (eventId.isEmpty()) {

            toast(
                    "צריך להזין קישור עובד או מזהה אירוע"
            );

            return;
        }

        if (workerName.isEmpty()) {

            toast(
                    "צריך להזין שם עובד"
            );

            return;
        }

        prefs.edit()
                .putString(
                        "event_id",
                        eventId
                )
                .putString(
                        "worker_name",
                        workerName
                )
                .putString(
                        "sector",
                        sector
                )
                .apply();

        requestPermissionsAndStart();
    }

    private void requestPermissionsAndStart() {

        List<String> permissions =
                new ArrayList<>();

        if (checkSelfPermission(
                Manifest.permission.ACCESS_FINE_LOCATION
        ) != PackageManager.PERMISSION_GRANTED) {

            permissions.add(
                    Manifest.permission.ACCESS_FINE_LOCATION
            );
        }

        if (checkSelfPermission(
                Manifest.permission.ACCESS_COARSE_LOCATION
        ) != PackageManager.PERMISSION_GRANTED) {

            permissions.add(
                    Manifest.permission.ACCESS_COARSE_LOCATION
            );
        }

        if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(
                        Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED) {

            permissions.add(
                    Manifest.permission.POST_NOTIFICATIONS
            );
        }

        if (!permissions.isEmpty()) {

            requestPermissions(
                    permissions.toArray(
                            new String[0]
                    ),
                    PERMISSION_REQUEST
            );

        } else {

            startTracking();
        }
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults
    ) {

        super.onRequestPermissionsResult(
                requestCode,
                permissions,
                grantResults
        );

        if (requestCode != PERMISSION_REQUEST) {
            return;
        }

        boolean locationGranted =
                checkSelfPermission(
                        Manifest.permission.ACCESS_FINE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
                ||
                checkSelfPermission(
                        Manifest.permission.ACCESS_COARSE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED;

        if (locationGranted) {

            startTracking();

        } else {

            statusText.setText(
                    "🔴 אין הרשאת מיקום"
            );

            toast(
                    "יש לאשר הרשאת מיקום כדי להפעיל מעקב"
            );
        }
    }

    private void startTracking() {

        Intent service =
                new Intent(
                        this,
                        LocationService.class
                );

        service.setAction(
                LocationService.ACTION_START
        );

        if (Build.VERSION.SDK_INT >= 26) {

            startForegroundService(service);

        } else {

            startService(service);
        }

        prefs.edit()
                .putBoolean(
                        "tracking",
                        true
                )
                .apply();

        statusText.setText(
                "🟢 שיתוף המיקום פעיל"
        );

        toast(
                "שיתוף המיקום הופעל"
        );
    }

    private void stopTracking() {

        Intent service =
                new Intent(
                        this,
                        LocationService.class
                );

        service.setAction(
                LocationService.ACTION_STOP
        );

        startService(service);

        prefs.edit()
                .putBoolean(
                        "tracking",
                        false
                )
                .apply();

        statusText.setText(
                "⚫ שיתוף המיקום הופסק"
        );

        toast(
                "שיתוף המיקום הופסק"
        );
    }

    private void openWorkerPage() {

        String eventId =
                extractEventId(
                        eventInput.getText().toString()
                );

        if (eventId.isEmpty()) {

            toast(
                    "אין מזהה אירוע"
            );

            return;
        }

        String url =
                "https://thaerdj4-afk.github.io/fire-command/worker.html?event="
                        + Uri.encode(eventId);

        Intent browser =
                new Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse(url)
                );

        startActivity(browser);
    }

    private void openBatterySettings() {

        try {

            Intent intent =
                    new Intent(
                            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
                    );

            intent.setData(
                    Uri.parse(
                            "package:" +
                                    getPackageName()
                    )
            );

            startActivity(intent);

        } catch (Exception e) {

            try {

                Intent intent =
                        new Intent(
                                Settings.ACTION_APPLICATION_DETAILS_SETTINGS
                        );

                intent.setData(
                        Uri.parse(
                                "package:" +
                                        getPackageName()
                        )
                );

                startActivity(intent);

            } catch (Exception ignored) {
            }
        }
    }

    private LinearLayout.LayoutParams fullWidth() {

        return new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
    }

    private LinearLayout.LayoutParams fieldParams() {

        LinearLayout.LayoutParams params =
                fullWidth();

        params.setMargins(
                0,
                dp(7),
                0,
                dp(7)
        );

        return params;
    }

    private LinearLayout.LayoutParams buttonParams() {

        LinearLayout.LayoutParams params =
                fullWidth();

        params.setMargins(
                0,
                dp(9),
                0,
                dp(9)
        );

        return params;
    }

    private int dp(int value) {

        return (int) (
                value *
                getResources()
                        .getDisplayMetrics()
                        .density
        );
    }

    private void toast(String message) {

        Toast.makeText(
                this,
                message,
                Toast.LENGTH_SHORT
        ).show();
    }
          }
