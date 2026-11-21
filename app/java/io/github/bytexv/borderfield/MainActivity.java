package io.github.bytexv.borderfield;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.WindowInsets;
import android.webkit.*;
import android.widget.FrameLayout;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/index.html";
    private static final int INSTALL_PERMISSION = 81;
    private static final int MAX_APK = 64 * 1024 * 1024;
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private final AtomicBoolean checking = new AtomicBoolean();
    private WebView web;
    private PackageInfo installed;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try { installed = getPackageManager().getPackageInfo(getPackageName(), PackageManager.GET_SIGNATURES); }
        catch (PackageManager.NameNotFoundException impossible) { throw new IllegalStateException(impossible); }
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.rgb(247,245,236));
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            frame.setOnApplyWindowInsetsListener((v,insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(bars.left,bars.top,bars.right,bars.bottom);
                return insets;
            });
        }
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(247,245,236));
        WebSettings prefs = web.getSettings();
        prefs.setJavaScriptEnabled(true);
        prefs.setDomStorageEnabled(true);
        prefs.setAllowFileAccess(false);
        prefs.setAllowContentAccess(false);
        prefs.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return true; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri uri = r.getUrl();
                String path = uri.getPath();
                if ("https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && path != null && path.matches("/[a-zA-Z0-9_./-]+") && !path.contains("..")) {
                    try {
                        String name = path.substring(1);
                        String mime = name.endsWith(".js") ? "text/javascript" : name.endsWith(".css") ? "text/css" :
                            name.endsWith(".svg") ? "image/svg+xml" : name.endsWith(".ttf") ? "font/ttf" : "text/html";
                        return new WebResourceResponse(mime, name.endsWith(".ttf") ? null : "UTF-8", getAssets().open(name));
                    } catch (IOException missing) { /* Return a local 404. */ }
                }
                return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",null,null);
            }
        });
        web.addJavascriptInterface(new Bridge(), "Borderfield");
        frame.addView(web);
        setContentView(frame);
        web.loadUrl(START);
    }

    public final class Bridge {
        @JavascriptInterface public String version() { return installed.versionName; }
        @JavascriptInterface public void checkUpdates(boolean manual) {
            long last = getPreferences(MODE_PRIVATE).getLong("lastCheck",0);
            if (!manual && System.currentTimeMillis()-last < 86400000L) return;
            if (!checking.compareAndSet(false,true)) return;
            network.execute(() -> {
                try { findRelease(); }
                catch (Exception e) { status("Couldn’t check GitHub. Check your connection and try again."); }
                finally { checking.set(false); }
            });
        }
    }

    private void status(String message) {
        runOnUiThread(() -> { if (alive()) web.evaluateJavascript("window.onUpdateStatus("+JSONObject.quote(message)+")",null); });
    }
    private boolean alive() { return !isFinishing() && !isDestroyed(); }
    private HttpURLConnection connect(String url) throws IOException {
        HttpURLConnection connection = (HttpURLConnection)new URL(url).openConnection();
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("User-Agent","Borderfield/"+installed.versionName);
        return connection;
    }
    private void checked() { getPreferences(MODE_PRIVATE).edit().putLong("lastCheck",System.currentTimeMillis()).apply(); }

    private void findRelease() throws Exception {
        HttpURLConnection con = connect("https://api.github.com/repos/"+Release.REPOSITORY+"/releases/latest");
        JSONObject release;
        try {
            con.setRequestProperty("Accept","application/vnd.github+json");
            if (con.getResponseCode()==404) { checked(); status("No public release is available in the update repository yet."); return; }
            try (InputStream in = con.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int n;
                while ((n=in.read(buffer))!=-1) {
                    if (out.size()+n>512*1024) throw new IOException("Release metadata too large");
                    out.write(buffer,0,n);
                }
                release = new JSONObject(out.toString("UTF-8"));
            }
        } finally { con.disconnect(); }
        String tag = release.getString("tag_name");
        int next = versionCode(tag);
        if (next<=0) { status("The latest release has an unrecognized version tag."); return; }
        if (next<=installed.versionCode) { checked(); status("You have the latest version ("+installed.versionName+")."); return; }
        JSONArray assets = release.getJSONArray("assets");
        for (int i=0;i<assets.length();i++) {
            JSONObject asset = assets.getJSONObject(i);
            String url = asset.optString("browser_download_url");
            if (!url.equals("https://github.com/"+Release.REPOSITORY+"/releases/download/"+tag+"/Borderfield.apk")) continue;
            String digest = asset.optString("digest","");
            int size = asset.getInt("size");
            if (size<=0 || size>MAX_APK) throw new IOException("Invalid APK size");
            checked();
            status("Version "+tag.substring(1)+" is available.");
            runOnUiThread(() -> { if (alive()) new AlertDialog.Builder(this).setTitle("Update Borderfield?")
                .setMessage("Version "+tag.substring(1)+" is available on GitHub. Your quiz progress will carry over.")
                .setNegativeButton("Later",null).setPositiveButton("Download",(d,w) -> download(url,digest,size,next)).show(); });
            return;
        }
        status("The latest release has no Android APK yet.");
    }

    static int versionCode(String tag) {
        if (!tag.matches("v[1-9][0-9]{0,2}\\.[0-9]{1,3}\\.[0-9]{1,3}")) return -1;
        String[] fields = tag.substring(1).split("\\.");
        return Integer.parseInt(fields[0])*1000000 + Integer.parseInt(fields[1])*1000 + Integer.parseInt(fields[2]);
    }
    private void download(String url, String digest, int size, int version) {
        status("Downloading update…");
        android.widget.Toast.makeText(this,"Downloading Borderfield update…",android.widget.Toast.LENGTH_SHORT).show();
        network.execute(() -> {
            File tmp = new File(getCacheDir(),"pending-update.apk");
            try {
                MessageDigest hash = MessageDigest.getInstance("SHA-256");
                HttpURLConnection con = connect(url);
                try (InputStream in = con.getInputStream(); OutputStream out = new FileOutputStream(tmp)) {
                    int total=0,n; byte[] buffer = new byte[16384];
                    while ((n=in.read(buffer))!=-1) {
                        total+=n;
                        if (total>size) throw new IOException("Unexpected download size");
                        hash.update(buffer,0,n); out.write(buffer,0,n);
                    }
                    if (total!=size) throw new IOException("Incomplete download");
                } finally { con.disconnect(); }
                StringBuilder actual = new StringBuilder("sha256:");
                for (byte b:hash.digest()) actual.append(String.format(Locale.ROOT,"%02x",b&255));
                if (digest.startsWith("sha256:")&&!digest.contentEquals(actual)) throw new IOException("Digest mismatch");
                PackageInfo apk = getPackageManager().getPackageArchiveInfo(tmp.getPath(),PackageManager.GET_SIGNATURES);
                if (apk==null || !getPackageName().equals(apk.packageName) || apk.versionCode!=version || version<=installed.versionCode ||
                        installed.signatures==null || !Arrays.equals(installed.signatures,apk.signatures)) throw new IOException("APK identity mismatch");
                if (!tmp.renameTo(UpdateFile.apk(this))) throw new IOException("Cannot stage update");
                runOnUiThread(() -> { if (alive()) requestInstall(); });
            } catch (Exception e) {
                status("Update download or verification failed. Check your connection and try again.");
                runOnUiThread(() -> { if (alive()) new AlertDialog.Builder(this).setTitle("Update unavailable")
                    .setMessage("The download could not be verified. Try again from Settings.").setPositiveButton("OK",null).show(); });
            } finally { tmp.delete(); }
        });
    }
    private void requestInstall() {
        if (getPackageManager().canRequestPackageInstalls()) { launchInstaller(); return; }
        new AlertDialog.Builder(this).setTitle("Allow app updates")
            .setMessage("Android needs permission for Borderfield to open its verified update. Enable “Allow from this source”, then return here.")
            .setNegativeButton("Later",null).setPositiveButton("Open settings",(d,w) -> {
                try { startActivityForResult(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+getPackageName())),INSTALL_PERMISSION); }
                catch (android.content.ActivityNotFoundException e) { status("Open Android Settings to allow installs from Borderfield."); }
            }).show();
    }
    @Override protected void onActivityResult(int request,int result,Intent intent) {
        super.onActivityResult(request,result,intent);
        if (request==INSTALL_PERMISSION && getPackageManager().canRequestPackageInstalls() && UpdateFile.apk(this).exists()) launchInstaller();
    }
    private void launchInstaller() {
        Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(UpdateFile.URI,UpdateFile.MIME)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.setClipData(android.content.ClipData.newRawUri("Borderfield update",UpdateFile.URI));
        try { startActivity(intent); }
        catch (android.content.ActivityNotFoundException e) { status("Android could not open the package installer."); }
    }
    @Override public void onBackPressed() {
        web.evaluateJavascript("typeof borderfieldBack==='function' && borderfieldBack()",value -> {
            if (!"true".equals(value)) super.onBackPressed();
        });
    }
    @Override protected void onDestroy() { network.shutdownNow(); super.onDestroy(); }
}
