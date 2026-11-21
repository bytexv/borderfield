package io.github.bytexv.borderfield;

import android.content.*;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.*;

public final class UpdateFile extends ContentProvider {
    static final Uri URI = Uri.parse("content://io.github.bytexv.borderfield.update/Borderfield.apk");
    static final String MIME = "application/vnd.android.package-archive";
    static File apk(Context context) { return new File(context.getCacheDir(), "Borderfield.apk"); }

    private void validate(Uri uri) {
        if (!URI.equals(uri)) throw new IllegalArgumentException("Unknown file");
    }
    @Override public boolean onCreate() { return true; }
    @Override public String getType(Uri uri) { validate(uri); return MIME; }
    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        validate(uri);
        if (!"r".equals(mode)) throw new FileNotFoundException("Read only");
        return ParcelFileDescriptor.open(apk(getContext()), ParcelFileDescriptor.MODE_READ_ONLY);
    }
    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String order) {
        validate(uri);
        String[] columns = projection == null ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE} : projection;
        MatrixCursor cursor = new MatrixCursor(columns);
        Object[] values = new Object[columns.length];
        for (int i = 0; i < columns.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(columns[i])) values[i] = "Borderfield.apk";
            if (OpenableColumns.SIZE.equals(columns[i])) values[i] = apk(getContext()).length();
        }
        cursor.addRow(values);
        return cursor;
    }
    @Override public Uri insert(Uri u, ContentValues v) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri u, String s, String[] a) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri u, ContentValues v, String s, String[] a) { throw new UnsupportedOperationException(); }
}
