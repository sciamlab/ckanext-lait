
import logging
import routes.mapper
import ckan.lib.base as base
import ckan.lib.helpers as h
import ckan.plugins as p
import ckan.plugins.toolkit as tk
import urllib2
from ckan.common import _, json
import collections
from pylons import config
import pylons
from ckan.common import request, c
import ckan.lib.navl as navl
import sets
import ckan
import ckan.lib.jsonp as jsonp

log = logging.getLogger(__name__)

def categories():
    url = config.get('ckan.base_url', '')+'/CKANAPIExtension/categories?count=true'
    try:
        response = urllib2.urlopen(url)
        response_body = response.read()
    except Exception, inst:
        msg = "Couldn't connect to categories service %r: %s" % (url, inst)
        raise Exception, msg
    try:
        categories = json.loads(response_body)
    except Exception, inst:
        msg = "Couldn't read response from categories service %r: %s" % (response_body, inst)
        raise Exception, inst
    return categories

def apps(params):
    url = config.get('ckan.base_url', '')+'/CKANAPIExtension/apps?'+params
    try:
        response = urllib2.urlopen(url)
        response_body = response.read()
    except Exception, inst:
        msg = "Couldn't connect to apps service %r: %s" % (url, inst)
        raise Exception, msg
    try:
        apps = json.loads(response_body)
    except Exception, inst:
        msg = "Couldn't read response from apps service %r: %s" % (response_body, inst)
        raise Exception, inst
    result = h.Page(
        collection=apps,
        page=request.params.get('page', 1),
        url=h.pager_url,
        items_per_page=20
    )
    return result

def comuni():
    response_body = ''
    try:
        comuni = json.loads(response_body)
    except Exception, inst:
        msg = "Couldn't read response from comuni service %r: %s" % (response_body, inst)
        raise Exception, inst
    return comuni

def facets():
    d = collections.OrderedDict()
    d['organization'] = _('Organizations')
    d['category'] = _('Categories')
    d['rating_average_int'] = _('Community Rating')
    d['tags'] = _('Tags')
    d['res_format'] = _('Formats')
    d['license_id'] = _('Licenses')
    return d

def translate_resource_data_dict(data_dict):
    '''Return the given dict with as many of its fields
    as possible translated into the desired or the fallback language.

    '''
    try:
        desired_lang_code = pylons.request.environ['CKAN_LANG']
    except Exception, e:
        desired_lang_code = 'it'
    
    fallback_lang_code = pylons.config.get('ckan.locale_default', 'en')

    # Get a flattened copy of data_dict to do the translation on.
    flattened = navl.dictization_functions.flatten_dict(data_dict)

    # Get a simple flat list of all the terms to be translated, from the
    # flattened data dict.
    terms = sets.Set()
    for (key, value) in flattened.items():
        if value in (None, True, False):
            continue
        elif isinstance(value, basestring):
            terms.add(value)
        elif isinstance(value, (int, long)):
            continue
        else:
            for item in value:
                 terms.add(item)

    # Get the translations of all the terms (as a list of dictionaries).
    translations = ckan.logic.action.get.term_translation_show(
            {'model': ckan.model},
            {'terms': terms,
                'lang_codes': (desired_lang_code, fallback_lang_code)})
    # Transform the translations into a more convenient structure.
    desired_translations = {}
    fallback_translations = {}
    for translation in translations:
        if translation['lang_code'] == desired_lang_code:
            desired_translations[translation['term']] = (
                    translation['term_translation'])
        else:
            assert translation['lang_code'] == fallback_lang_code
            fallback_translations[translation['term']] = (
                    translation['term_translation'])

    # Make a copy of the flattened data dict with all the terms replaced by
    # their translations, where available.
    translated_flattened = {}
    for (key, value) in flattened.items():

        # Don't translate names that are used for form URLs.
        if key == ('name',):
            if value in desired_translations:
                translated_flattened[key] = desired_translations[value]
            elif value in fallback_translations:
                translated_flattened[key] = fallback_translations.get(value, value)
            else:
                translated_flattened[key] = value

        elif value in (None, True, False):
            # Don't try to translate values that aren't strings.
            translated_flattened[key] = value

        elif isinstance(value, basestring):
            if value in desired_translations:
                translated_flattened[key] = desired_translations[value]
            else:
                translated_flattened[key] = fallback_translations.get(
                        value, value)

        elif isinstance(value, (int, long, dict)):
            translated_flattened[key] = value

        else:
            translated_value = []
            for item in value:
                if item in desired_translations:
                    translated_value.append(desired_translations[item])
                else:
                    translated_value.append(
                        fallback_translations.get(item, item)
                    )
            translated_flattened[key] = translated_value
    # Finally unflatten and return the translated data dict.
    translated_data_dict = (navl.dictization_functions
            .unflatten(translated_flattened))
    return translated_data_dict

def translate_resource_data_dict_list(data_dict_list):
    translated = []
    for dict in data_dict_list:
        translated.append(translate_resource_data_dict(dict))
    return translated

def translate_related_list(related_list):
    translated = []
    for related in related_list:
        dict = {'title':related.title, 'description':related.description}
        dict_trans = translate_resource_data_dict(dict)
        dict_trans['id'] = related.id
        dict_trans['type'] = related.type
        dict_trans['url'] = related.url
        translated.append(dict_trans)
    return translated

class LaitPlugin(p.SingletonPlugin, tk.DefaultDatasetForm):
    p.implements(p.IDatasetForm)
    p.implements(p.IConfigurer)
    p.implements(p.IRoutes)
    p.implements(p.ITemplateHelpers)
    p.implements(p.IResourceController, inherit=True)

    def before_show(self, data_dict):
        translated_data_dict = translate_resource_data_dict(data_dict)
        return translated_data_dict

    def get_helpers(self):
        return {'translate_related_list': translate_related_list, 'translate_resource_data_dict_list': translate_resource_data_dict_list, 'apps': apps, 'comuni': comuni, 'categories': categories, 'facets':facets}

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
            m.connect('categories_index', '/category', action='category')
            m.connect('apps_index', '/app', action='app')
            m.connect('translator_index', '/translator', action='translator')
            m.connect('disqus', '/disqus', action='disqus')
            m.connect('geocoding_gazetteer', '/geocoding_gazetteer', action='geocoding_gazetteer')
        return route_map

    def after_map(self, route_map):
        return route_map


class LaitController(base.BaseController):

    def category(self):
        return base.render('category/index.html')

    def app(self):
        return base.render('app/index.html')

    def translator(self):
        context = {'model': ckan.model, 'session': ckan.model.Session,
                   'user': c.user or c.author, 'auth_user_obj': c.userobj,
                   'save': 'save' in request.params}
        try:
            ckan.logic.check_access('package_create', context)
        except ckan.logic.NotAuthorized:
            base.abort(401, _('Unauthorized to access translator'))
        return base.render('translator/index.html')

    def disqus(self):
        c.data = {
            'id': request.params.get('id', u''),
            'title': request.params.get('title', u'')
        }
        return base.render('package/disqus.html')

    @jsonp.jsonpify
    def geocoding_gazetteer(self):
        q = request.params.get('q', '')
        limit = request.params.get('limit', 20)
        response_body = '{"ResultSet": {"Result": [{"Name": "Artena", "Value": "41.741230 12.912126"}, {"Name": "Via Catone", "Value": "41.907078 12.459023"}, {"Name": "Ciampino", "Value": "41.799315 12.589956"}, {"Name": "Colleferro", "Value": "41.726717 13.003762"}, {"Name": "Fonte Nuova", "Value": "42.001102 12.628789"}, {"Name": "Via Frascati", "Value": "41.819438 12.698100"}, {"Name": "Via Marino", "Value": "41.855321 12.747131"}, {"Name": "Monte Porzio Catone", "Value": "41.818371 12.715984"}, {"Name": "Roma", "Value": "41.873013 12.487933"}, {"Name": "Valmontone", "Value": "41.774455 12.920125"}]}}'

        try:
            result = json.loads(response_body)
            resultSetJson = result['ResultSet']
            resultValueJson = resultSetJson['Result']
            result = [obj for obj in resultValueJson if q.upper() in obj['Name'].upper()]	    
        except Exception, inst:
            msg = "Couldn't read response from geocoding service %r: %s" % (response_body, inst)
            raise Exception, inst
        return result