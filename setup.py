from setuptools import setup, find_packages

setup(name="prewikka-apps-macrovisualization",
      version="5.2.0",
      author="Marco Compagno",
      author_email="marco_compagno@elmisoftware.com",
      url="https://www.prelude-siem.org",
      packages=find_packages(),
      install_requires=["prewikka >= 5.0.0"],
      entry_points={
          "prewikka.views": [
              "Macrovisualization = macrovisualization:Macrovisualization",
          ],
          'prewikka.updatedb': [
            'macrovisualization = macrovisualization.sql'
        ]
      },
      package_data={
          "macrovisualization": [
              "templates/*.mak",
              "sql/*.py",
              "htdocs/css/*.css",
              "htdocs/js/*.js"
          ],
      },
      
)