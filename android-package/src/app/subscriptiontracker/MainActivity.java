package app.subscriptiontracker;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final String PREFS = "tracker";
    private static final String KEY_URL = "url";
    private static final int FILE_CHOOSER = 41;

    private WebView web;
    private View setup;
    private View progress;
    private EditText link;
    private TextView error;
    private ValueCallback<Uri[]> fileCallback;
    private boolean pageFailed;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        web = findViewById(R.id.web);
        setup = findViewById(R.id.setup);
        progress = findViewById(R.id.progress);
        link = findViewById(R.id.link);
        error = findViewById(R.id.error);
        prepareWeb();
        findViewById(R.id.open).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                openTypedLink();
            }
        });
        String saved = prefs().getString(KEY_URL, "");
        if (!TextUtils.isEmpty(saved)) {
            link.setText(saved);
            showSite(saved);
        } else {
            showSetup(null);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void prepareWeb() {
        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, true);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setAllowFileAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                pageFailed = false;
                progress.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                if (!pageFailed) {
                    setup.setVisibility(View.GONE);
                    web.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError errorInfo) {
                if (request != null && request.isForMainFrame()) {
                    pageFailed = true;
                    progress.setVisibility(View.GONE);
                    showSetup(getString(R.string.link_failed));
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request == null || request.getUrl() == null) return true;
                String scheme = request.getUrl().getScheme();
                return scheme == null || !scheme.equals("https");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = params.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER);
                } catch (ActivityNotFoundException exception) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });
    }

    private void openTypedLink() {
        String normalized = normalize(link.getText() == null ? "" : link.getText().toString());
        if (normalized == null) {
            showSetup(getString(R.string.link_invalid));
            return;
        }
        prefs().edit().putString(KEY_URL, normalized).apply();
        link.setText(normalized);
        showSite(normalized);
    }

    private void showSite(String url) {
        error.setVisibility(View.GONE);
        setup.setVisibility(View.GONE);
        web.setVisibility(View.VISIBLE);
        progress.setVisibility(View.VISIBLE);
        web.loadUrl(url);
    }

    private void showSetup(String message) {
        web.setVisibility(View.GONE);
        progress.setVisibility(View.GONE);
        setup.setVisibility(View.VISIBLE);
        if (TextUtils.isEmpty(message)) {
            error.setVisibility(View.GONE);
        } else {
            error.setText(message);
            error.setVisibility(View.VISIBLE);
        }
    }

    private String normalize(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) return null;
        if (!value.contains("://")) value = "https://" + value;
        Uri uri = Uri.parse(value);
        if (uri.getScheme() == null || !uri.getScheme().equals("https")) return null;
        if (TextUtils.isEmpty(uri.getHost()) || !uri.getHost().contains(".")) return null;
        return value;
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != FILE_CHOOSER || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null && data.getClipData().getItemCount() > 0) {
                int count = data.getClipData().getItemCount();
                result = new Uri[count];
                for (int i = 0; i < count; i++) {
                    result[i] = data.getClipData().getItemAt(i).getUri();
                }
            } else if (data.getData() != null) {
                result = new Uri[] {data.getData()};
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    @Override
    public void onBackPressed() {
        if (web.getVisibility() == View.VISIBLE && web.canGoBack()) {
            web.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onPause() {
        CookieManager.getInstance().flush();
        super.onPause();
    }
}
