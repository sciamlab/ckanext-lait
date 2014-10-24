
import logging
import routes.mapper
import ckan.lib.base as base
import ckan.plugins as p
import ckan.plugins.toolkit as tk
import urllib2
from ckan.common import _, json
import collections
from pylons import config
log = logging.getLogger(__name__)

def categories():
    url = config.get('ckan.base_url', '')+'/CKANAPIExtension/getcategories?count=true'
    try:
        response = urllib2.urlopen(url)
        response_body = response.read()
        # log.info(response_body)
    except Exception, inst:
        msg = "Couldn't connect to categories service %r: %s" % (url, inst)
        raise Exception, msg
    try:
        categories = json.loads(response_body)
        # log.info(categories)
    except Exception, inst:
        msg = "Couldn't read response from categories service %r: %s" % (response_body, inst)
        raise Exception, inst
    return categories

def facets():
    d = collections.OrderedDict()
    d['organization'] = _('Organizations')
    d['category'] = _('Categories')
    d['rating_average_int'] = _('Community Rating')
    d['tags'] = _('Tags')
    d['res_format'] = _('Formats')
    d['license_id'] = _('Licenses')
    return d

class LaitPlugin(p.SingletonPlugin, tk.DefaultDatasetForm):
    p.implements(p.IDatasetForm)
    p.implements(p.IConfigurer)
    p.implements(p.IRoutes)
    p.implements(p.ITemplateHelpers)

    def get_helpers(self):
        return {'categories': categories, 'facets':facets}

    def update_config(self, config):
        # Add this plugin's templates dir to CKAN's extra_template_paths, so
        # that CKAN will use this plugin's custom templates.
        # 'templates' is the path to the templates dir, relative to this
        # plugin.py file.
        tk.add_template_directory(config, 'templates')
        tk.add_public_directory(config, 'public')
        tk.add_resource('public', 'ckanext-lait')

    def _modify_package_schema(self, schema):
        schema.update({
            'spatial': [tk.get_validator('ignore_missing'),
                            tk.get_converter('convert_to_extras')]
        })
        schema.update({
            'rating_count': [tk.get_validator('ignore_missing'),
                            tk.get_converter('convert_to_extras')]
        })
        schema.update({
            'rating_average_int': [tk.get_validator('ignore_missing'),
                            tk.get_converter('convert_to_extras')]
        })
        schema.update({
            'rating_average': [tk.get_validator('ignore_missing'),
                            tk.get_converter('convert_to_extras')]
        })
        schema.update({
            'category': [tk.get_validator('ignore_missing'),
                            tk.get_converter('convert_to_extras')]
        })
        return schema

    def create_package_schema(self):
        schema = super(LaitPlugin, self).create_package_schema()
        schema = self._modify_package_schema(schema)
        return schema

    def update_package_schema(self):
        schema = super(LaitPlugin, self).update_package_schema()
        schema = self._modify_package_schema(schema)
        return schema

    def show_package_schema(self):
        schema = super(LaitPlugin, self).show_package_schema()
        schema.update({
            'spatial': [tk.get_converter('convert_from_extras'),
                            tk.get_validator('ignore_missing')]
        })
        schema.update({
            'rating_count': [tk.get_converter('convert_from_extras'),
                            tk.get_validator('ignore_missing')]
        })
	schema.update({
            'rating_average_int': [tk.get_converter('convert_from_extras'),
                            tk.get_validator('ignore_missing')]
        })
        schema.update({
            'rating_average': [tk.get_converter('convert_from_extras'),
                            tk.get_validator('ignore_missing')]
        })
        schema.update({
            'category': [tk.get_converter('convert_from_extras'),
                            tk.get_validator('ignore_missing')]
            })
        return schema

    def is_fallback(self):
        # Return True to register this plugin as the default handler for
        # package types not handled by any other IDatasetForm plugin.
        return True

    def package_types(self):
        # This plugin doesn't handle any special package types, it just
        # registers itself as the default (above).
        return []

    def before_map(self, route_map):
        with routes.mapper.SubMapper(route_map,
                controller='ckanext.lait.plugin:LaitController') as m:
            m.connect('categories_index', '/category', action='index')
        return route_map

    def after_map(self, route_map):
        return route_map


class LaitController(base.BaseController):

    def index(self):
        return base.render('category/index.html')
