class classproperty(object):
    def __init__(self, f):
        self.f = f
    def __get__(self, obj, owner):
        return self.f(owner)

class UseEverywhere():
    @classmethod
    def INPUT_TYPES(s):
        return {"required":{},
                "optional": { x.lower() : (x, {}) for x in s.RETURN_TYPES }
                }
    FUNCTION = "func"
    CATEGORY = "everywhere"
    OUTPUT_NODE = True

    def func(self, **kwargs):
        return tuple([kwargs.get(t.lower(),None) for t in self.RETURN_TYPES])   
    
class UseSomewhere(UseEverywhere):
    @classmethod
    def INPUT_TYPES(s):
        it = {"required":{},
                "optional": { x.lower() : (x, {}) for x in s.RETURN_TYPES }
                }
        it['optional']['title'] = ("STRING", {"default":".*"})
        it['optional']['input'] = ("STRING", {"default":".*"})
        return it

class SeedEverywhere():
    @classmethod
    def INPUT_TYPES(s):
        return {"required":{ "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}) }}
    OUTPUT_NODE = True

    RETURN_TYPES = ("INT",)
    FUNCTION = "func"
    CATEGORY = "everywhere"

    def func(self, seed):
        return (seed,)
