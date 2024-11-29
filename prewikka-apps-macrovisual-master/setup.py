from setuptools import setup 

setup(name="prewikka-macrovisual", 
    version="1.0.0", 
    author="Marco Compagno", 
    author_email="marco_compagno@elmisoftware.com", 
    url="https://prelude-siem.org", 
    packages=["macrovisual"], 
    install_requires=["prewikka >= 5.0.0"], 
    entry_points={ 
        "prewikka.views": [ 
            "macrovisual = macrovisual:macrovisual", 
        ], 
    }, 

    package_data={ 
        "macrovisual": ["htdocs/css/*.css", "htdocs/js/*.js", "templates/*.py", "templates/*.tmpl"] 
    }) 