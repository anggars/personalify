from PIL import Image, ImageFilter
import os

def pad_icon(input_path, output_path, scale_factor=0.5):
    try:
        img = Image.open(input_path).convert("RGBA")
        
        # ERODE Alpha to remove white fringe/halo (Defringe)
        # Extract Alpha
        r, g, b, a = img.split()
        # Filter Alpha with MinFilter (Erosion)
        a = a.filter(ImageFilter.MinFilter(5)) # Aggressive 5 (radius 2)
        # Recombine
        img = Image.merge("RGBA", (r, g, b, a))
        
        width, height = img.size
        
        # CROP artifacts/corners (8%)
        margin_w = int(width * 0.08)
        margin_h = int(height * 0.08)
        img = img.crop((margin_w, margin_h, width - margin_w, height - margin_h))
        width, height = img.size # Update dims
        
        # Sample background color from top-center
        # Assuming the icon has a bit of padding/margin where the color is visible
        sample_x = width // 2
        sample_y = min(10, height // 4) 
        bg_color = img.getpixel((sample_x, sample_y))
        
        # Ensure alpha is full if we are treating it as solid background
        # But if the sample is transparent, we might fail. 
        # However, user says "radius", meaning there is a box. The visible box background.
        # If the sample is transparent, we scan for first non-transparent pixel?
        # Let's assume the box starts somewhat near the edge.
        
        # Basic check: if sample is transparent, find center color? No, P is there.
        # Let's try to find the "dominant" border color.
        
        # Simplify: Create a solid square of correct color.
        # IF the image is "Rounded Box", the corners are transparent.
        # We want to fill them with "Box Color".
        
        # Check pixel at center-ish border
        if bg_color[3] == 0:
             # Try a bit deeper
             bg_color = img.getpixel((sample_x, 30))
        
        solid_bg_color = (bg_color[0], bg_color[1], bg_color[2], 255)
        print(f"Detected Icon Background Color: {solid_bg_color}")

        # Create a full square base with this color
        base = Image.new("RGBA", (width, height), solid_bg_color)
        # Composite original icon on top (filling transparent corners with solid color)
        base.alpha_composite(img)
        
        # NOW use this 'base' as the image to resize
        img = base
        
        # Calculate new size
        new_width = int(width * scale_factor)
        new_height = int(height * scale_factor)
        
        # Resize the icon (now a solid square)
        resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Create the final transparent canvas 
        # Wait, if we put a Square on a Background, we need the Background to MATCH.
        # So we should pass this color to 'create_background' too!
        
        new_img = Image.new("RGBA", (width, height), (0,0,0,0))
        x_offset = (width - new_width) // 2
        y_offset = (height - new_height) // 2
        new_img.paste(resized_img, (x_offset, y_offset)) # No mask, as it's solid square now
        
        new_img.save(output_path)
        print(f"Successfully saved padded icon to {output_path}")
        return solid_bg_color
        
    except Exception as e:
        print(f"Error: {e}")
        return (40, 40, 40, 255)

def create_background(width, height, output_path, color=(40, 40, 40, 255)): # #282828
    try:
        img = Image.new("RGBA", (width, height), color)
        img.save(output_path)
        print(f"Successfully saved background to {output_path}")
    except Exception as e:
        print(f"Error creating background: {e}")

if __name__ == "__main__":
    input_file = "mobile/assets/icon.png"
    output_file = "mobile/assets/icon_padded.png"
    bg_file = "mobile/assets/icon_background.png"
    
    if os.path.exists(input_file):
        detected_color = pad_icon(input_file, output_file)
        # Create background with same dims as original
        with Image.open(input_file) as img:
            create_background(img.width, img.height, bg_file, detected_color)
    else:
        print(f"Input file not found: {input_file}")
