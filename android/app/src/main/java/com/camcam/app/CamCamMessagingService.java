package com.camcam.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class CamCamMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "camcam_reminders";

    @Override public void onNewToken(String token){
        getSharedPreferences("camcam_app",MODE_PRIVATE).edit().putString("fcm_token",token).apply();
    }

    @Override public void onMessageReceived(RemoteMessage message){
        String title="CamCam",body="اعلان جدید";
        if(message.getNotification()!=null){
            if(message.getNotification().getTitle()!=null)title=message.getNotification().getTitle();
            if(message.getNotification().getBody()!=null)body=message.getNotification().getBody();
        }
        String route=message.getData().get("route");if(route==null)route="home";
        NotificationManager manager=(NotificationManager)getSystemService(Context.NOTIFICATION_SERVICE);
        if(manager==null)return;
        if(Build.VERSION.SDK_INT>=26){
            NotificationChannel channel=new NotificationChannel(CHANNEL_ID,"یادآورها و اعلان‌ها",NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("یادآورهای مراقبت، دارو، واکسن و اعلان‌های CamCam");manager.createNotificationChannel(channel);
        }
        Intent intent=new Intent(this,MainActivity.class).putExtra("camcam_route",route)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending=PendingIntent.getActivity(this,Math.abs(message.getMessageId()==null?body.hashCode():message.getMessageId().hashCode()),intent,
            PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder notification=new NotificationCompat.Builder(this,CHANNEL_ID)
            .setSmallIcon(com.camcam.app.R.drawable.ic_camcam).setContentTitle(title).setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body)).setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true).setContentIntent(pending).setDefaults(NotificationCompat.DEFAULT_ALL);
        manager.notify((int)(System.currentTimeMillis()%Integer.MAX_VALUE),notification.build());
    }

    static void dispatchTokenToActivity(MainActivity activity,String token){activity.deliverPushToken(token);}
}
