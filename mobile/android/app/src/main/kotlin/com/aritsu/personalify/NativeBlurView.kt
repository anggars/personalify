package com.aritsu.personalify

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RenderEffect
import android.graphics.Shader
import android.os.Build
import android.view.View
import android.view.ViewTreeObserver
import android.widget.ImageView
import io.flutter.plugin.platform.PlatformView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.bitmap.BitmapTransitionOptions
import com.bumptech.glide.request.RequestOptions
import jp.wasabeef.glide.transformations.BlurTransformation

class NativeBlurView(private val context: Context, id: Int, creationParams: Map<String, Any>?) : PlatformView {
    private val imageView: ImageView = ImageView(context)

    init {
        imageView.scaleType = ImageView.ScaleType.CENTER_CROP
        
        val imageUrl = creationParams?.get("imageUrl") as? String
        
        // USER REQUEST: "Resolution Trap Fix: Downsample to save GPU bandwidth"
        // Radius: 25 (Increased because of downsampling)
        // Sampling: 3 (Downsample 3x -> 9x less pixels -> Much Faster on QHD screens)
        if (imageUrl != null) {
            Glide.with(context)
                .asBitmap()
                .load(imageUrl)
                .apply(RequestOptions.bitmapTransform(BlurTransformation(25, 3))) 
                .transition(BitmapTransitionOptions.withCrossFade())
                .into(imageView)
        }
    }

    override fun getView(): View {
        return imageView
    }

    override fun dispose() {}
}
