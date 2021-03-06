const querystring = require('querystring');
const got = require('@/utils/got');
const { fallback, queryToBoolean, queryToInteger } = require('@/utils/readable-social');

const weiboUtils = {
    formatExtended: (ctx, status, params = {}, picsPrefixes = []) => {
        // undefined and strings like "1" is also safely parsed, so no if branch is needed
        const routeParams = querystring.parse(ctx.params.routeParams);

        const mergedParams = {
            readable: fallback(params.readable, queryToBoolean(routeParams.readable), false),
            authorNameBold: fallback(params.authorNameBold, queryToBoolean(routeParams.authorNameBold), false),
            showAuthorInTitle: fallback(params.showAuthorInTitle, queryToBoolean(routeParams.showAuthorInTitle), false),
            showAuthorInDesc: fallback(params.showAuthorInDesc, queryToBoolean(routeParams.showAuthorInDesc), false),
            showAuthorAvatarInDesc: fallback(params.showAuthorAvatarInDesc, queryToBoolean(routeParams.showAuthorAvatarInDesc), false),
            showAtBeforeAuthor: fallback(params.showAtBeforeAuthor, null, false),
            showEmojiForRetweet: fallback(params.showEmojiForRetweet, queryToBoolean(routeParams.showEmojiForRetweet), false),
            showRetweetTextInTitle: fallback(params.showRetweetTextInTitle, queryToBoolean(routeParams.showRetweetTextInTitle), true),
            addLinkForPics: fallback(params.addLinkForPics, queryToBoolean(routeParams.addLinkForPics), false),
            showTimestampInDescription: fallback(params.showTimestampInDescription, queryToBoolean(routeParams.showTimestampInDescription), false),

            widthOfPics: fallback(params.widthOfPics, queryToInteger(routeParams.widthOfPics), -1),
            heightOfPics: fallback(params.heightOfPics, queryToInteger(routeParams.heightOfPics), -1),
            sizeOfAuthorAvatar: fallback(params.sizeOfAuthorAvatar, queryToInteger(routeParams.sizeOfAuthorAvatar), 48),
        };

        params = mergedParams;

        const {
            readable,
            authorNameBold,
            showAuthorInTitle,
            showAuthorInDesc,
            showAuthorAvatarInDesc,
            showAtBeforeAuthor,
            showEmojiForRetweet,
            showRetweetTextInTitle,
            addLinkForPics,
            showTimestampInDescription,

            widthOfPics,
            heightOfPics,
            sizeOfAuthorAvatar,
        } = params;

        let retweeted = '';
        // ??????????????????
        let htmlNewLineUnreplaced = (status.longText && status.longText.longTextContent) || status.text || '';
        // ???????????????????????????
        htmlNewLineUnreplaced = htmlNewLineUnreplaced.replace(/<span class="url-icon"><img.*?alt="?(.*?)"? [\s\S]*?\/><\/span>/g, '$1');
        // ???????????????????????????
        htmlNewLineUnreplaced = htmlNewLineUnreplaced.replace(/<span class=["|']url-icon["|']>.*?<\/span><span class="surl-text">(.*?)<\/span>/g, '$1');
        // ???????????????????????????
        htmlNewLineUnreplaced = htmlNewLineUnreplaced.replace(/<span class=["|']url-icon["|']>(.*?)<\/span>/g, '');
        // ????????????
        htmlNewLineUnreplaced = htmlNewLineUnreplaced.replace(/??????<br>/g, '<br>');
        htmlNewLineUnreplaced = htmlNewLineUnreplaced.replace(/<a href="(.*?)">??????<\/a>/g, '');

        // ??????????????????
        htmlNewLineUnreplaced = htmlNewLineUnreplaced.replace(/https:\/\/weibo\.cn\/sinaurl\/.*?&u=(http.*?")/g, function (match, p1) {
            return decodeURIComponent(p1);
        });

        let html = htmlNewLineUnreplaced.replace(/\n/g, '<br>');

        // ????????????????????????
        if (showAuthorInDesc) {
            let usernameAndAvatar = `<a href="https://weibo.com/${status.user.id}" target="_blank">`;
            if (showAuthorAvatarInDesc) {
                usernameAndAvatar += `<img width="${sizeOfAuthorAvatar}" height="${sizeOfAuthorAvatar}" src="${status.user.profile_image_url}" ${readable ? 'hspace="8" vspace="8" align="left"' : ''} />`;
            }
            let name = status.user.screen_name;
            if (showAtBeforeAuthor) {
                name = '@' + name;
            }
            if (authorNameBold) {
                usernameAndAvatar += `<strong>${name}</strong></a>:&ensp;`;
            } else {
                usernameAndAvatar += `${name}</a>:&ensp;`;
            }
            html = usernameAndAvatar + html;
        }

        // ??????????????????
        if (status.pics) {
            if (readable) {
                html += '<br clear="both" /><div style="clear: both"></div>';
            }

            // ??????RSS Reader???????????????<img>?????????????????????????????????????????????????????????????????????????????????
            // ??????????????????description????????????????????????????????????????????????0
            let picsPrefix = '';
            status.pics.forEach(function (item) {
                picsPrefix += `<img width="0" height="0" hidden="true" src="${item.large.url}">`;
            });
            picsPrefixes.push(picsPrefix);

            status.pics.forEach(function (item) {
                if (addLinkForPics) {
                    html += '<a href="' + item.large.url + '">';
                }

                let style = '';
                html += '<img ';
                html += readable ? 'vspace="8" hspace="4"' : '';
                if (widthOfPics >= 0) {
                    html += ` width="${widthOfPics}"`;
                    style += `width: ${widthOfPics}px;`;
                }
                if (heightOfPics >= 0) {
                    html += ` height="${heightOfPics}"`;
                    style += `height: ${heightOfPics}px;`;
                }
                html += ` style="${style}"` + ' src="' + item.large.url + '">';

                if (addLinkForPics) {
                    html += '</a>';
                }

                if (!readable) {
                    html += '<br><br>';
                }

                htmlNewLineUnreplaced += '<img src="" />';
            });
        }

        // ?????????????????????
        if (status.retweeted_status) {
            if (readable) {
                html += `<br clear="both" /><div style="clear: both"></div><blockquote style="background: #80808010;border-top:1px solid #80808030;border-bottom:1px solid #80808030;margin:0;padding:5px 20px;">`;
            } else {
                html += `<br><blockquote> - ?????? `;
            }
            if (!status.retweeted_status.user) {
                // ??????????????????????????????user???null
                status.retweeted_status.user = {
                    profile_image_url: '',
                    screen_name: '[?????????????????????]',
                    id: 'sorry',
                };
            }
            // ?????????????????????
            const retweetedParams = Object.assign({}, params);
            retweetedParams.showAuthorInDesc = true;
            retweetedParams.showAuthorAvatarInDesc = false;
            retweetedParams.showAtBeforeAuthor = true;
            retweeted += weiboUtils.formatExtended(ctx, status.retweeted_status, retweetedParams, picsPrefixes).description;

            html += retweeted;

            if (readable) {
                html += `<br><small>?????????<a href="https://weibo.com/${status.retweeted_status.user.id}/${status.retweeted_status.bid}" target="_blank" rel="noopener noreferrer">https://weibo.com/${status.retweeted_status.user.id}/${status.retweeted_status.bid}</a></small>`;
            }
            if (showTimestampInDescription) {
                html += `<br><small>` + new Date(status.retweeted_status.created_at).toLocaleString() + `</small>`;
            }
            if (readable) {
                html += `<br clear="both" /><div style="clear: both"></div>`;
            }

            html += '</blockquote>';
        }

        if (showAuthorInDesc && showAuthorAvatarInDesc) {
            html = picsPrefixes.join('') + html;
        }

        let title = '';
        if (showAuthorInTitle) {
            title += status.user.screen_name + ': ';
        }
        if (!status.retweeted_status || showRetweetTextInTitle) {
            title += htmlNewLineUnreplaced
                .replace(/<img[\s\S]*?>/g, '[??????]')
                .replace(/<.*?>/g, '')
                .replace('\n', '');
        }
        if (status.retweeted_status) {
            title += showEmojiForRetweet ? '???? ' : ' - ?????? ';
            title += retweeted
                .replace(/<img[\s\S]*?>/g, '[??????]')
                .replace(/<.*?>/g, '')
                .replace('\n', '');
        }

        return { description: html, title: title };
    },
    getShowData: async (uid, bid) => {
        const link = `https://m.weibo.cn/statuses/show?id=${bid}`;
        const itemResponse = await got.get(link, {
            headers: {
                Referer: `https://m.weibo.cn/u/${uid}`,
                'MWeibo-Pwa': 1,
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
            },
        });
        return itemResponse.data.data;
    },
    formatVideo: (itemDesc, status) => {
        const pageInfo = status.page_info;
        if (pageInfo && pageInfo.type === 'video') {
            const pagePic = pageInfo.page_pic;
            const mediaInfo = pageInfo.media_info;
            const posterUrl = pagePic ? pagePic.url : '';
            const videoUrl = mediaInfo ? mediaInfo.stream_url_hd || mediaInfo.stream_url || mediaInfo.mp4_hd_url || mediaInfo.mp4_sd_url || mediaInfo.mp4_720p_mp4 : '';
            if (videoUrl) {
                const video = `<br clear="both" /><div style="clear: both"></div><video src="${videoUrl}"  controls="controls" poster="${posterUrl}" style="width: 100%"></video>`;
                itemDesc += video;
            }
        }
        return itemDesc;
    },
};

module.exports = weiboUtils;
