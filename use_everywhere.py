class classproperty(object):
    def __init__(self, f):
        self.f = f
    def __get__(self, obj, owner):
        return self.f(owner)

class UseEverywhere():
    TYPE = None

    @classmethod
    def INPUT_TYPES(s):
        return {"required":{s.TYPE.lower(): (s.TYPE,{})}}
    
    @classproperty
    def RETURN_TYPES(s):
        return (s.TYPE,)
    
    FUNCTION = "func"
    CATEGORY = "anywhere"
    OUTPUT_NODE = True

    def func(self, **kwargs):
        return (kwargs[self.TYPE.lower()],)
