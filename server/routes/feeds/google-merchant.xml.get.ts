/**
 * Merchant Center feed for the fr market.
 *
 * Register this URL against the countries the fr pages are priced for. The
 * feed quotes that market's price list and links to that market's URLs, so the
 * page Google crawls shows the figure the feed declared.
 *
 * Serving is delegated so that every locale shares one refusal rule: a feed
 * that comes back empty is never published, because Google reads an empty feed
 * as a withdrawn catalogue.
 */
import { defineEventHandler } from 'h3'
import { serveMerchantFeed } from '../../feeds/merchant'

export default defineEventHandler((event) => serveMerchantFeed(event, 'fr'))
