import os, git, sys
sys.path.insert(0,os.path.join(os.path.dirname(os.path.realpath(__file__)),"..",".."))

def installer(custom_node_path):
    repo_url = 'https://github.com/chrisgoringe/cg-custom-core.git/'
    repo_path = os.path.join(custom_node_path,"cg_custom_core")
    if os.path.exists(os.path.join(repo_path, '.git')):
        print("Updating cg_custom_nodes")
        repo:git.Repo = git.Repo(repo_path)
        origin = repo.remote(name='origin')
        origin.pull(rebase=True)
        repo.git.submodule('update','--init','--recursive')
        repo.close()
    else:
        print("Installing cg_custom_nodes")
        repo = git.Repo.clone_from(repo_url, repo_path)
        repo.git.clear_cache()
        repo.git.submodule('update','--init','--recursive')
        repo.close()

if 'custom_nodes' in os.getcwd():
    installer(os.path.join(os.getcwd(),".."))