import os, git, sys, shutil
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

    print("Removing deployed web extensions - this may mean you need to restart ComfyUI")
    application_web_extensions_directory = os.path.join(custom_node_path, "..", "web", "extensions")
    for thing in os.listdir(application_web_extensions_directory):
        path = os.path.join(application_web_extensions_directory,thing)
        if os.path.isdir(path):
            if thing != 'core':
                shutil.rmtree(path)
        else:
            os.remove(path)

if 'custom_nodes' in os.getcwd():
    installer(os.path.join(os.getcwd(),".."))
