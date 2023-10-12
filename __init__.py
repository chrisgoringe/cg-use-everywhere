from .use_everywhere import SeedEverywhere, AnythingEverywherePrompts

UE_VERSION = 4.1

NODE_CLASS_MAPPINGS = { "Seed Everywhere": SeedEverywhere }

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