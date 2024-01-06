from server import PromptServer
import torch

def message(id,message):
    if isinstance(message, torch.Tensor):
        string = f"Tensor shape {message.shape}"
    elif isinstance(message, dict) and "samples" in message and isinstance(message["samples"], torch.Tensor):
        string = f"Latent shape {message['samples'].shape}"
    else:
        string = f"{message}"
    PromptServer.instance.send_sync("ue-message-handler", {"id": id, "message":string})

class Base():
    OUTPUT_NODE = True
    FUNCTION = "func"
    CATEGORY = "everywhere"
    RETURN_TYPES = ()

class SimpleString(Base):
    OUTPUT_NODE = False
    @classmethod
    def INPUT_TYPES(s):
        return {"required":{ "string": ("STRING", {"default": ""}) }}
    RETURN_TYPES = ("STRING",)

    def func(self,string):
        return (string,)

class SeedEverywhere(Base):
    @classmethod
    def INPUT_TYPES(s):
        return {"required":{ "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}) },
                 "hidden": {"id":"UNIQUE_ID"} }

    RETURN_TYPES = ("INT",)

    def func(self, seed, id):
        message(id, seed)
        return (seed,)

class AnythingEverywhere(Base):
    @classmethod
    def INPUT_TYPES(s):
        return {"required":{}, 
                "optional": { "anything" : ("*", {}), },
                 "hidden": {"id":"UNIQUE_ID"} }

    def func(self, id, **kwargs):
        for key in kwargs:
            message(id, kwargs[key],)
        return ()

class AnythingEverywherePrompts(Base):
    @classmethod
    def INPUT_TYPES(s):
        return {"required":{}, 
                "optional": { "+ve" : ("*", {}), "-ve" : ("*", {}), } }
    
    def func(self, **kwargs):
        return ()
        
class AnythingEverywhereTriplet(Base):
    @classmethod
    def INPUT_TYPES(s):
        return {"required":{}, 
                "optional": { "anything" : ("*", {}), "anything2" : ("*", {}), "anything3" : ("*", {}),} }
    
    def func(self, **kwargs):
        return ()
    
class AnythingSomewhere(Base):
    @classmethod
    def INPUT_TYPES(s):
        return {"required":{}, 
                "optional": { 
                    "anything" : ("*", {}), 
                    "title_regex" : ("STRING", {"default":".*"}),
                    "input_regex" : ("STRING", {"default":".*"}),
                    "group_regex" : ("STRING", {"default":".*"}),
                    },
                 "hidden": {"id":"UNIQUE_ID"} }

    def func(self, id, title_regex=None, input_regex=None, group_regex=None, **kwargs):
        for key in kwargs:
            message(id, kwargs[key],)
        return ()
