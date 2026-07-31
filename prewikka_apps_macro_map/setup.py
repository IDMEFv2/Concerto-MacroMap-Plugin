from setuptools import setup, find_packages

setup(name="prewikka-apps-macro_map",
      version="3.1.0",
      author="Marco Compagno",
      author_email="marco_compagno@elmisoftware.com",
      url="https://www.prelude-siem.org",
      packages=find_packages(),
      install_requires=["prewikka >= 5.0.0"],
      entry_points={
          "prewikka.views": [
              "Macro_Map = macro_map:Macro_Map",
          ],
          'prewikka.updatedb': [
            'macro_map = macro_map.sql'
        ]
      },
      package_data={
          "macro_map": [
              "templates/*.mak",
              "sql/*.py",
              "htdocs/css/*.css",
              "htdocs/js/*.js",
              "htdocs/samples/*.csv",
              "htdocs/samples/*.xlsx",
              "htdocs/samples/*.md",
              "htdocs/samples/presets/*.csv",
              "htdocs/assets/flags/*.svg",
          ],
      },
      
)