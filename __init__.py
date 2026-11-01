from comfy_api.latest import ComfyExtension, io
from .use_everywhere import SeedEverywhere, AnythingEverywhere, AnythingSomewhere, AnythingEverywhereTriplet, SimpleString, ComboClone, AnythingEverywherePrompts

UE_VERSION = "8.0.1"  # sync:version
WEB_DIRECTORY = "./js"
__all__ = [ "WEB_DIRECTORY"]

async def comfy_entrypoint() -> ComfyExtension:
    class UseEverywhereExtension(ComfyExtension):
        async def get_node_list(self) -> list[type[io.ComfyNode]]:
            return [
                AnythingEverywhere, AnythingSomewhere, AnythingEverywhereTriplet, SimpleString, ComboClone, SeedEverywhere, AnythingEverywherePrompts
            ]
        
    return UseEverywhereExtension()
