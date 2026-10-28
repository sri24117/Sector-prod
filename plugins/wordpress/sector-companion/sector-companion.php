<?php
/**
 * Plugin Name: SEctOr Companion
 * Description: Lets SEctOr (authenticated via WordPress Application Passwords) apply audit fixes. Renders JSON-LD server-side so non-JS AI crawlers can read it.
 * Version: 0.2.0
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
    'callback' => function () { return ['ok' => true, 'version' => '0.2.0']; },
  ]);

  register_rest_route('sector/v1', '/schema', [
    [
      'methods' => 'GET', 'permission_callback' => $can,
      'callback' => function () {
        $value = get_option('sector_jsonld', false);
        return ['jsonLd' => $value === false ? null : json_decode($value, true)];
      },
    ],
    [
      'methods' => 'POST', 'permission_callback' => $can,
      'callback' => function (WP_REST_Request $req) {
        global $wpdb;
        $params = $req->get_json_params();
        if (!is_array($params) || !array_key_exists('expectedJsonLd', $params) || !array_key_exists('jsonLd', $params)) {
          return new WP_Error('snapshot_required', 'An approved previous value is required.', ['status' => 400]);
        }
        $doc = $params['jsonLd'];
        if ($doc !== null && (!is_array($doc) || empty($doc['@type']))) {
          return new WP_Error('invalid_schema', 'jsonLd must be an object with @type or null to restore an empty value.', ['status' => 400]);
        }
        // Read the database value directly. The conditional update below is atomic
        // even when two authenticated requests arrive together.
        $raw = $wpdb->get_var($wpdb->prepare("SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", 'sector_jsonld'));
        $current = $raw === null ? null : json_decode($raw, true);
        if ($current != $params['expectedJsonLd']) {
          return new WP_Error('stale_schema', 'The schema changed after review.', ['status' => 409]);
        }
        $encoded = wp_json_encode($doc);
        if ($raw === null) {
          if (!add_option('sector_jsonld', $encoded, '', false)) return new WP_Error('stale_schema', 'Review the new schema value.', ['status' => 409]);
        } elseif ($raw !== $encoded) {
          $changed = $wpdb->update($wpdb->options, ['option_value' => $encoded], ['option_name' => 'sector_jsonld', 'option_value' => $raw]);
          if ($changed !== 1) return new WP_Error('stale_schema', 'Review the new schema value.', ['status' => 409]);
          wp_cache_delete('sector_jsonld', 'options');
          wp_cache_delete('alloptions', 'options');
        }
        return ['ok' => true];
      },
    ],
  ]);
});

add_action('wp_head', function () {
  $json = get_option('sector_jsonld');
  if ($json && is_array(json_decode($json, true))) {
    // wp_json_encode output, escaped for </script> safety.
    echo '<script type="application/ld+json">' . str_replace('</', '<\/', $json) . '</script>' . "\n";
  }
});
