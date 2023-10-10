try:
    from custom_nodes.cg_custom_core import CC_VERSION
    if CC_VERSION < 2.2:
        raise Exception()
except:
    print("cg_custom_core 2.2 not found - will try to install - you may need to restart afterwards")
    from .install import installer
    import os
    import folder_paths
    application_root_directory = os.path.dirname(folder_paths.__file__)
    installer(os.path.join(application_root_directory,"custom_nodes"))

from .use_everywhere import UseEverywhere, UseSomewhere, SeedEverywhere, AnythingEverywherePrompts

UE_VERSION = 3.1

# Types and the UE {t} and UE? {t} nodes are deprecated in v2, will be hidden in v3 and removed in v4
types = {
    "MODEL" : ("MODEL",),
    "VAE" : ("VAE",),
    "CLIP" : ("CLIP",),
    "LATENT" : ("LATENT", ),
    "IMAGE" : ("IMAGE",),
    "MASK" : ("MASK",),
    "CONDITIONING" : ("CONDITIONING",),
    "INT" : ("INT",),
    "CHECKPOINT" : ("MODEL", "CLIP", "VAE"),
}

NODE_CLASS_MAPPINGS = { "Seed Everywhere": SeedEverywhere }

for t in types:
    NODE_CLASS_MAPPINGS[f"UE {t}"] = type(f"UE {t}", (UseEverywhere,), { "RETURN_TYPES":types[t] })
    NODE_CLASS_MAPPINGS[f"UE? {t}"] = type(f"UE {t}", (UseSomewhere,), { "RETURN_TYPES":types[t] })

from .use_everywhere import AnythingEverywhere, AnythingSomewhere, AnythingEverywhereTriplet
NODE_CLASS_MAPPINGS["Anything Everywhere"] = AnythingEverywhere
NODE_CLASS_MAPPINGS["Anything Everywhere3"] = AnythingEverywhereTriplet
NODE_CLASS_MAPPINGS["Anything Everywhere?"] = AnythingSomewhere
NODE_CLASS_MAPPINGS["Prompts Everywhere"] = AnythingEverywherePrompts

__all__ = ['NODE_CLASS_MAPPINGS']

import os, shutil
import folder_paths
module_js_directory = os.path.join(os.path.dirname(os.path.realpath(__file__)), "js")
application_root_directory = os.path.dirname(folder_paths.__file__)
extension_web_extensions_directory = os.path.join(application_root_directory, "web", "extensions", "use_everywhere")

shutil.copytree(module_js_directory, extension_web_extensions_directory, dirs_exist_ok=True)

old_code_location = os.path.join(application_root_directory, "web", "extensions", "cg-nodes", "use_everywhere.js")
if os.path.exists(old_code_location):
    os.remove(old_code_location)