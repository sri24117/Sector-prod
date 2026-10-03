<?php
/**
 * Plugin Name: SEctOr Companion
 * Description: Lets SEctOr (authenticated via WordPress Application Passwords) apply audit fixes. Renders JSON-LD server-side so non-JS AI crawlers can read it.
 * Version: 0.1.0
 *
 * NOTE: written to the WordPress REST/options API contract but NOT yet run on a
 * real WordPress install (the build sandbox had no WP). Test on a staging site
 * before any client install — see docs/plans/feature-spec-slice3-remediation.md.
 */
if (!defined('ABSPATH')) { exit; }

add_action('rest_api_init', function () {
  $can = function () { return current_user_can('manage_options'); };

  register_rest_route('sector/v1', '/status', [
    'methods' => 'GET', 'permission_callback' => $can,
    'callback' => function () { return ['ok' => true, 'version' => '0.1.0']; },
  ]);

  register_rest_route('sector/v1', '/schema', [
    'methods' => 'POST', 'permission_callback' => $can,
    'callback' => function (WP_REST_Request $req) {
      $doc = $req->get_param('jsonLd');
      if (!is_array($doc) || empty($doc['@type'])) {
        return new WP_Error('invalid_schema', 'jsonLd must be an object with @type', ['status' => 400]);
      }
      update_option('sector_jsonld', wp_json_encode($doc), false);
      return ['ok' => true];
    },
  ]);
});

add_action('wp_head', function () {
  $json = get_option('sector_jsonld');
  if ($json) {
    // wp_json_encode output, escaped for </script> safety.
    echo '<script type="application/ld+json">' . str_replace('</', '<\/', $json) . '</script>' . "\n";
  }
});
