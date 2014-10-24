from setuptools import setup, find_packages
import sys, os

version = '0.1'

setup(
    name='ckanext-lait',
    version=version,
    description="Lait Extension",
    long_description='''
    ''',
    classifiers=[], # Get strings from http://pypi.python.org/pypi?%3Aaction=list_classifiers
    keywords='',
    author='Sciamlab',
    author_email='info@sciamlab.com',
    url='',
    license='',
    packages=find_packages(exclude=['ez_setup', 'examples', 'tests']),
    namespace_packages=['ckanext', 'ckanext.lait'],
    include_package_data=True,
    zip_safe=False,
    install_requires=[
        # -*- Extra requirements: -*-
    ],
    entry_points='''
        [ckan.plugins]
        # Add plugins here, e.g.
        # myplugin=ckanext.lait.plugin:PluginClass
        lait = ckanext.lait.plugin:LaitPlugin
    ''',
)
