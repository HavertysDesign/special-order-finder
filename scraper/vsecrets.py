import os
def secret(name):
    if os.environ.get(name): return os.environ[name]
    p=os.path.join(os.path.dirname(__file__),'..','.secrets.env')
    if os.path.exists(p):
        for l in open(p):
            if l.startswith(name+'='): return l.strip().split('=',1)[1]
    raise SystemExit(f'missing secret {name}')
