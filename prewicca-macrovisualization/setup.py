from setuptools import setup 

setup(name="prewikka-map", 
    version="1.0.0", 
    author="Marco Compagno", 
    author_email="marco_compagno@elmisoftware.com", 
    url="https://prelude-siem.org", 
    packages=["map"], 
    install_requires=["prewikka >= 5.0.0"], 
    entry_points={ 
        "prewikka.views": [ 
            "map = map:map", 
        ], 
    }, 

    package_data={ 
        "map": ["htdocs/css/*.css", "htdocs/js/*.js", "inventory.json", "templates/*.py", "templates/*.tmpl"] 
    }) 
