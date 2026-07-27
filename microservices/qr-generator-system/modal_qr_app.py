import modal
from pydantic import BaseModel
import io
import base64

# Define the container image and dependencies
def download_models():
    import torch
    from diffusers import StableDiffusionPipeline, ControlNetModel
    ControlNetModel.from_pretrained(
        "monster-labs/control_v1p_sd15_qrcode_monster",
        torch_dtype=torch.float16
    )
    StableDiffusionPipeline.from_pretrained(
        "runwayml/stable-diffusion-v1-5",
        torch_dtype=torch.float16
    )

image = (
    modal.Image.debian_slim()
    .pip_install("torch")
    .pip_install(
        "accelerate",
        "fastapi",
        "Pillow",
        "qrcode[pil]",
        "huggingface_hub"
    )
    .pip_install("transformers", "diffusers")
    .run_function(download_models)
)

app = modal.App("qr-ai-generator")

# We define the secrets required (the user token we configured)
# For webhooks, we don't necessarily need a Modal secret if we implement our own header check,
# but Modal has native support for proxy auth. Since we are using standard web_endpoint,
# we will implement a simple header check for the secret.

class GenerateRequest(BaseModel):
    url: str
    prompt: str
    secret: str

@app.cls(image=image, gpu="A10G", timeout=300)
class AIGenerator:
    @modal.enter()
    def setup(self):
        import torch
        from diffusers import StableDiffusionControlNetPipeline, ControlNetModel, UniPCMultistepScheduler
        
        print("Loading ControlNet model...")
        self.controlnet = ControlNetModel.from_pretrained(
            "monster-labs/control_v1p_sd15_qrcode_monster",
            torch_dtype=torch.float16
        )
        
        print("Loading Stable Diffusion model...")
        self.pipe = StableDiffusionControlNetPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            controlnet=self.controlnet,
            torch_dtype=torch.float16
        )
        
        self.pipe.scheduler = UniPCMultistepScheduler.from_config(self.pipe.scheduler.config)
        self.pipe.enable_model_cpu_offload()
        print("Models loaded successfully.")

    @modal.method()
    def generate(self, url: str, prompt: str):
        import qrcode
        from PIL import Image
        import torch
        
        # 1. Generate base QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(url)
        qr.make(fit=True)
        
        base_img = qr.make_image(fill_color="black", back_color="white")
        base_img = base_img.resize((512, 512), Image.NEAREST)
        
        # 2. Run Inference
        generator = torch.manual_seed(42) # Fixed seed for consistency, or random
        
        # Hyperparameters recommended for QR Code Monster
        output = self.pipe(
            prompt=prompt + ", masterpiece, high quality, highly detailed",
            negative_prompt="ugly, disfigured, low quality, blurry, text",
            image=base_img,
            width=512,
            height=512,
            guidance_scale=7.0,
            controlnet_conditioning_scale=1.95, # Increased control to make it scannable
            generator=generator,
            num_inference_steps=40, # More steps for better quality
        )
        
        final_image = output.images[0]
        
        # Convert to Base64
        buffered = io.BytesIO()
        final_image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        return img_str

@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def webhook(req: GenerateRequest):
    # Verify Secret
    if req.secret != "ws-Xfvp6XgEPc6i46DbC9nymo":
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    generator = AIGenerator()
    b64_image = generator.generate.remote(req.url, req.prompt)
    
    return {"success": True, "image_b64": b64_image}
